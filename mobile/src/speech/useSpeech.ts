import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

export type SpeechState = "idle" | "preparing" | "recording" | "processing";
export type StartResult = { ok: true } | { ok: false; reason: "permission" | "mic" };

interface UseSpeechResult {
  state: SpeechState;
  listening: boolean;
  start: () => Promise<StartResult>;
  /** Stops recording and resolves with base64 audio (or null if nothing usable). */
  stop: () => Promise<string | null>;
  reset: () => void;
}

export function useSpeech(): UseSpeechResult {
  const [state, setState] = useState<SpeechState>("idle");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const permissionRef = useRef<boolean | null>(null);

  useEffect(() => {
    return () => {
      const rec = recordingRef.current;
      if (rec) {
        rec.stopAndUnloadAsync().catch(() => undefined);
        recordingRef.current = null;
      }
    };
  }, []);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (permissionRef.current === true) return true;
    const { status, canAskAgain } = await Audio.requestPermissionsAsync();
    if (status === "granted") {
      permissionRef.current = true;
      return true;
    }
    if (status === "undetermined" && canAskAgain) {
      const again = await Audio.requestPermissionsAsync();
      permissionRef.current = again.status === "granted";
      return permissionRef.current;
    }
    return false;
  }, []);

  const start = useCallback(async (): Promise<StartResult> => {
    const granted = await ensurePermission();
    if (!granted) return { ok: false, reason: "permission" };
    try {
      setState("preparing");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: 1, // doNotMix
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1, // doNotMix
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setState("recording");
      return { ok: true };
    } catch {
      setState("idle");
      return { ok: false, reason: "mic" };
    }
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) {
      setState("idle");
      return null;
    }
    try {
      setState("processing");
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (!uri) {
        setState("idle");
        return null;
      }
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setState("idle");
      return base64;
    } catch {
      setState("idle");
      return null;
    }
  }, []);

  const reset = useCallback(() => setState("idle"), []);

  return { state, listening: state === "recording", start, stop, reset };
}
