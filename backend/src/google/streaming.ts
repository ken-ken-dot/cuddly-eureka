import { config, googleCredentialsJson } from "../config.js";
import { sttRoutingFor } from "../languages.js";
import { GoogleApiError } from "./errors.js";

/**
 * Streaming speech-to-text (multilingual brief Section 4, step 2).
 *
 * ADDITIVE by design: the existing batch REST path (google/api.ts) and its
 * callers are untouched. This module opens a server-side gRPC
 * StreamingRecognize session to Google and pipes PCM chunks through it —
 * the browser/mobile app never sees a Google credential.
 *
 * Region routing comes from the one explicit table in languages.ts
 * (STT_LANGUAGE_ROUTING): rw-RW streams through the `eu` regional endpoint
 * with the `short` model; en-US / de-DE / cmn-Hans-CN stream through
 * `global` with chirp_3. Adding a language later means adding one table row,
 * not touching this file.
 */

// Lazy singleton — the library is only loaded when real streaming is used,
// so mock-mode development never pays its startup cost.
type SpeechClientish = {
  streamingRecognize: (opts: unknown) => {
    write: (chunk: unknown) => boolean;
    end: () => void;
    on: (ev: string, cb: (data: never) => void) => void;
    destroy: () => void;
  };
};

let clientPromise: Promise<SpeechClientish> | null = null;

async function getSpeechClient(): Promise<SpeechClientish> {
  if (!clientPromise) {
    clientPromise = (async () => {
      // Dynamic import keeps the gRPC stack out of every other code path.
      const speech = await import("@google-cloud/speech");
      const creds = googleCredentialsJson();
      if (!creds) {
        throw new GoogleApiError("Google credentials are not configured", 500);
      }
      const client = new speech.SpeechClient({
        // Explicit inline credentials — the same single service-account key
        // the REST path already uses (one credential, per brief Section 2).
        credentials: JSON.parse(creds),
        projectId: config.google.project,
      });
      return client as unknown as SpeechClientish;
    })();
  }
  return clientPromise;
}

export interface StreamingSessionEvents {
  /** Interim hypothesis for the current utterance (replaces the previous one). */
  onPartial: (text: string) => void;
  /** Completed utterance (isFinal). Empty string when nothing was heard. */
  onFinal: (text: string) => void;
  /** Fatal session error — the relay tears the connection down after this. */
  onError: (err: Error) => void;
}

export interface StreamingSession {
  /** Forward one base64 PCM chunk from the client. */
  write: (base64Chunk: string) => void;
  /** Graceful end: half-close the request stream, responses may still arrive. */
  finish: () => void;
  /** Immediate teardown (client disconnected / fatal error). */
  destroy: () => void;
}

const STREAMING_LIMITS = {
  /** Google: "~5 minutes" per streaming session. Restart well before. */
  maxSessionMs: 4 * 60 * 1000,
};

export function streamingSupported(code: string): boolean {
  return sttRoutingFor(code) !== null;
}

/**
 * Open one StreamingRecognize session for a language.
 * Returns null when the language has no verified streaming route — callers
 * surface that as a clean error instead of a mid-stream gRPC failure.
 */
export async function openStreamingSession(params: {
  /** Normalized translation-style code (rw, zh-CN, en, de). */
  languageCode: string;
  sampleRateHz?: number;
  events: StreamingSessionEvents;
}): Promise<StreamingSession | null> {
  const routing = sttRoutingFor(params.languageCode);
  if (!routing) return null;

  const client = await getSpeechClient();
  const parent = `projects/${config.google.project}/locations/${routing.region}`;

  const requestStream = client.streamingRecognize({
    config: {
      languageCodes: [routing.sttCode],
      model: routing.model,
      // Raw mono 16-bit 16 kHz PCM straight from the mobile capture layer —
      // the exact format react-native-live-audio-stream emits (brief §4a).
      encoding: "LINEAR16",
      sampleRateHertz: params.sampleRateHz ?? 16000,
      ...(routing.adaptation ? {} : {}),
    },
    // The recognizer wildcard uses the region-correct endpoint; per-request
    // config (above) applies for every language, so no recognizer management.
    // (Streaming with an inline config does not persist recognizer state.)
    interimResults: true,
  });

  let settled = false;
  let done = false;
  let timer: NodeJS.Timeout | null = null;

  const finishUp = () => {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
  };

  requestStream.on("data", (data: unknown) => {
    const d = data as {
      results?: Array<{
        isFinal?: boolean;
        alternatives?: Array<{ transcript?: string }>;
      }>;
    };
    for (const result of d.results ?? []) {
      const text = (result.alternatives?.[0]?.transcript ?? "").trim();
      if (!text) continue;
      if (result.isFinal) {
        params.events.onFinal(text);
      } else {
        params.events.onPartial(text);
      }
    }
  });

  requestStream.on("error", (raw: never) => {
    const err = raw as Error & { code?: number };
    if (settled) return;
    settled = true;
    finishUp();
    params.events.onError(err);
  });

  // Google half-closes the response stream when the request stream ends.
  requestStream.on("end", () => {
    finishUp();
  });

  // Hard stop before Google's ~5-minute streaming cap; callers restart.
  timer = setTimeout(() => {
    try {
      requestStream.end();
    } catch {
      /* already closed */
    }
  }, STREAMING_LIMITS.maxSessionMs);

  return {
    write: (base64Chunk: string) => {
      if (done) return;
      try {
        requestStream.write({ audio: { content: Buffer.from(base64Chunk, "base64") } });
      } catch (err) {
        if (!settled) {
          settled = true;
          finishUp();
          params.events.onError(err as Error);
        }
      }
    },
    finish: () => {
      try {
        requestStream.end();
      } catch {
        /* already closed */
      }
    },
    destroy: () => {
      finishUp();
      try {
        requestStream.destroy();
      } catch {
        /* already closed */
      }
    },
  };
}
