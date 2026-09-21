import { Audio } from "expo-av";

/**
 * Continuous PCM capture (multilingual brief Section 4a).
 *
 * Preferred path: react-native-live-audio-stream — low-latency base64 PCM
 * chunks (16-bit mono 16 kHz, exactly what the relay/Google expect), emitted
 * as they're captured. It is a NATIVE module: present after `expo prebuild` /
 * a custom dev client, absent in Expo Go.
 *
 * Fallback path: expo-av chunked recording (the same library V1 already
 * ships) so the real-time UI stays exercisable in Expo Go and in tests —
 * without touching any V1 behavior. The relay protocol is identical either
 * way; only chunk latency differs.
 *
 * Config per brief Section 4a — 16 kHz, mono, 16-bit, VOICE_RECOGNITION.
 */

const LIVE_STREAM_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
  audioSource: 6, // VOICE_RECOGNITION on Android
  bufferSize: 4096,
} as const;

export interface LiveAudioHandle {
  /** Stream one captured chunk (base64 PCM) upstream. */
  onChunk: (base64Pcm: string) => void;
  /** Fires when capture ends for any reason other than an explicit stop. */
  onEnded?: (reason: "error") => void;
}

export interface LiveAudioSession {
  stop: () => Promise<void>;
}

/** Best-effort probe: does the native live-audio module exist in this build? */
async function liveStreamModuleAvailable(): Promise<boolean> {
  try {
    // Optional dependency — resolved dynamically so Expo Go (where the
    // native module is missing) takes the fallback without a crash.
    const mod = await import("react-native-live-audio-stream");
    return Boolean(mod?.default?.init);
  } catch {
    return false;
  }
}

async function ensureMicPermission(): Promise<boolean> {
  const { status, canAskAgain } = await Audio.requestPermissionsAsync();
  if (status === "granted") return true;
  if (status === "undetermined" && canAskAgain) {
    const again = await Audio.requestPermissionsAsync();
    return again.status === "granted";
  }
  return false;
}

/**
 * Start continuous capture. Resolves once capture is live (or rejects with a
 * reason the UI can present).
 */
export async function startLiveAudio(handle: LiveAudioHandle): Promise<LiveAudioSession> {
  if (!(await ensureMicPermission())) {
    throw new Error("PERMISSION");
  }

  if (await liveStreamModuleAvailable()) {
    const LiveAudioStream = (await import("react-native-live-audio-stream")).default;
    const listener = (data: string) => handle.onChunk(data);
    // Options shape per the library's own typings (wavFile is required even
    // though streaming mode never writes it).
    LiveAudioStream.init({ ...LIVE_STREAM_CONFIG, wavFile: "vuga-live.pcm" });
    LiveAudioStream.on("data", listener);
    LiveAudioStream.start();
    return {
      stop: async () => {
        try {
          await LiveAudioStream.stop();
        } catch {
          /* module already stopped */
        }
      },
    };
  }

  // --- expo-av fallback: record short chunks and stream them as they close.
  // Lets the full relay round-trip run in Expo Go / dev where the native
  // module isn't linked; real low-latency streaming needs the prebuild.
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: 1, // doNotMix
    shouldDuckAndroid: true,
    interruptionModeAndroid: 1, // doNotMix
  });

  let stopped = false;
  let current: Audio.Recording | null = null;

  const cycle = async () => {
    while (!stopped) {
      try {
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.LOW_QUALITY,
          undefined,
          1200, // roll the chunk every ~1.2 s
        );
        current = recording;
        await new Promise<void>((resolve) => {
          recording.setOnRecordingStatusUpdate((status) => {
            if (status.isDoneRecording) resolve();
          });
        });
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri && !stopped) {
          const FileSystem = await import("expo-file-system/legacy");
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          handle.onChunk(base64);
        }
      } catch {
        if (!stopped) handle.onEnded?.("error");
        return;
      } finally {
        current = null;
      }
    }
  };

  void cycle();

  return {
    stop: async () => {
      stopped = true;
      try {
        await current?.stopAndUnloadAsync();
      } catch {
        /* already stopped */
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => undefined);
    },
  };
}
