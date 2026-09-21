import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";

import { config, googleConfigured } from "./config.js";
import { normalizeLanguageCode } from "./languages.js";
import { runTranslate, mockTranscriptFor } from "./providers.js";
import { openStreamingSession, streamingSupported } from "./google/streaming.js";

/**
 * Real-time relay (multilingual brief Section 4). ADDITIVE: mounted next to
 * the existing REST routes — nothing about /api/transcribe|translate|tts
 * changes.
 *
 * Protocol (JSON frames both ways):
 *   client -> server:
 *     { type: "start", sourceLang, targetLang, sampleRate? }
 *     { type: "audio", data: <base64 PCM chunk> }
 *     { type: "stop" }
 *   server -> client:
 *     { type: "started" }
 *     { type: "partial", text }                 — interim STT hypothesis
 *     { type: "final", text, translated }       — one completed segment
 *     { type: "error", code, message }
 *     { type: "stopped" }
 *
 * The mobile app never talks to Google directly; credentials stay on the
 * server (brief Section 4). Final segments are translated through the SAME
 * runTranslate the REST route uses, so mock mode and error copy behave
 * identically to the working V1 flow.
 */

const WS_PATH = "/api/realtime";

/** One client connection's state. */
interface RelaySession {
  sourceLang: string | null;
  targetLang: string | null;
  streaming: {
    write: (b64: string) => void;
    finish: () => void;
    destroy: () => void;
  } | null;
  /** Serializes final-segment translation so replies keep transcript order. */
  queue: Promise<void>;
  /** Mock-mode final-segment ticker (never set when Google is configured). */
  mockTicker: NodeJS.Timeout | null;
}

export function attachRealtimeRelay(server: import("node:http").Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Upgrade only our path; everything else proceeds as before (Express owns
  // the request otherwise).
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== WS_PATH) return; // leave other upgrades untouched
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    const session: RelaySession = { sourceLang: null, targetLang: null, streaming: null, queue: Promise.resolve(), mockTicker: null };

    const send = (frame: Record<string, unknown>) => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify(frame));
        } catch {
          /* connection closing — nothing to do */
        }
      }
    };

    const teardownStreaming = () => {
      if (session.mockTicker) {
        clearInterval(session.mockTicker);
        session.mockTicker = null;
      }
      session.streaming?.destroy();
      session.streaming = null;
    };

    const startStreaming = (sampleRate?: number) => {
      teardownStreaming();
      const sourceLang = session.sourceLang;
      if (!sourceLang) return;

      if (!streamingSupported(sourceLang)) {
        send({
          type: "error",
          code: "UNSUPPORTED_LANGUAGE",
          message: "Real-time speech for that language isn't available yet.",
        });
        return;
      }

      if (config.provider !== "google" || !googleConfigured()) {
        // Mock relay: same deterministic transcript the REST mock returns for
        // the source language, so client flows are exercisable without keys.
        // Emits one fake final per ~1.5 s of "audio" to mimic segment timing.
        send({ type: "started", mock: true });
        session.mockTicker = setInterval(() => {
          if (ws.readyState === ws.OPEN) {
            const text = mockTranscriptFor(sourceLang);
            void runTranslate(text, sourceLang, session.targetLang ?? "")
              .then((mt) => send({ type: "final", text, translated: mt.translated }))
              .catch(() => undefined);
          }
        }, 1500);
        return;
      }

      openStreamingSession({
        languageCode: sourceLang,
        sampleRateHz: sampleRate ?? 16000,
        events: {
          onPartial: (text) => send({ type: "partial", text }),
          onFinal: (text) => {
            if (!text) return;
            const target = session.targetLang;
            if (!target) return;
            // Chain translations so concurrent finals reply in order.
            session.queue = session.queue
              .then(async () => {
                try {
                  const mt = await runTranslate(text, sourceLang, target);
                  send({ type: "final", text, translated: mt.translated });
                } catch (err) {
                  const e = err as Error & { code?: string };
                  send({
                    type: "error",
                    code: e.code ?? "UPSTREAM_ERROR",
                    message: e.message || "Translation failed for a spoken segment.",
                  });
                }
              })
              .catch(() => undefined);
          },
          onError: (err) => {
            const code = (err as Error & { code?: number }).code === 2 ? "UPSTREAM_ERROR" : "STREAM_FAILED";
            send({ type: "error", code, message: err.message || "Speech recognition failed." });
            teardownStreaming();
          },
        },
      })
        .then((st) => {
          if (!st) {
            send({
              type: "error",
              code: "UNSUPPORTED_LANGUAGE",
              message: "Real-time speech for that language isn't available yet.",
            });
            return;
          }
          session.streaming = st;
          send({ type: "started", mock: false });
        })
        .catch((err: Error) => {
          send({ type: "error", code: "PROVIDER_NOT_CONFIGURED", message: err.message });
        });
    };

    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (isBinary) return; // protocol is JSON frames only
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        send({ type: "error", code: "BAD_JSON", message: "Frame was not valid JSON." });
        return;
      }

      switch (msg.type) {
        case "start": {
          const source = normalizeLanguageCode(msg.sourceLang);
          const target = normalizeLanguageCode(msg.targetLang);
          if (!source || !target || source === target) {
            send({
              type: "error",
              code: "UNSUPPORTED_LANGUAGE",
              message: "Pick two different supported languages to translate between.",
            });
            return;
          }
          session.sourceLang = source;
          session.targetLang = target;
          const sampleRate = typeof msg.sampleRate === "number" ? msg.sampleRate : undefined;
          startStreaming(sampleRate);
          break;
        }
        case "audio": {
          if (typeof msg.data !== "string") return;
          if (session.streaming) {
            session.streaming.write(msg.data);
          }
          // In mock mode (streaming === null) chunks are intentionally ignored.
          break;
        }
        case "stop": {
          session.streaming?.finish();
          teardownStreaming();
          send({ type: "stopped" });
          break;
        }
        default:
          break; // ignore unknown frames — forward-compat
      }
    });

    ws.on("close", () => {
      teardownStreaming();
    });
    ws.on("error", () => {
      teardownStreaming();
    });
  });

  return wss;
}
