import { useSettings } from "../store/settings";

/**
 * Real-time relay client (multilingual brief Section 4). Connects to the
 * backend's /api/realtime WebSocket and streams base64 PCM chunks up while
 * partial/final transcripts come back down. Additive: the REST transcribe /
 * translate flow in api/client.ts is untouched and remains the fallback.
 *
 * The server never asks for a credential and the app never sees one —
 * credentials stay server-side (brief Section 4).
 */

export type RelayState = "idle" | "connecting" | "live" | "closing";

export interface RelayHandlers {
  onState?: (state: RelayState) => void;
  /** Interim hypothesis for the current utterance. */
  onPartial?: (text: string) => void;
  /** One completed spoken segment plus its translation. */
  onFinal?: (text: string, translated: string) => void;
  /** Soft error (session continues) or fatal error (session torn down). */
  onError?: (code: string, message: string, fatal: boolean) => void;
}

const FATAL_CODES = new Set(["UNSUPPORTED_LANGUAGE", "PROVIDER_NOT_CONFIGURED", "BAD_JSON"]);

export interface RelayHandle {
  sendAudioChunk: (base64Pcm: string) => void;
  stop: () => void;
}

export function openRealtimeSession(sourceLang: string, targetLang: string, handlers: RelayHandlers): RelayHandle {
  let ws: WebSocket | null = null;
  let closedByUs = false;
  let stopped = false;

  handlers.onState?.("connecting");

  try {
    const base = useSettings.getState().proxyUrl.replace(/^http/, "ws").replace(/\/+$/, "");
    ws = new WebSocket(`${base}/api/realtime`);
  } catch {
    handlers.onState?.("idle");
    handlers.onError?.("NETWORK", "Can't open the real-time connection. Check that the VUGA proxy is running.", true);
    return { sendAudioChunk: () => undefined, stop: () => undefined };
  }

  const socket = ws;

  socket.onopen = () => {
    socket.send(JSON.stringify({ type: "start", sourceLang, targetLang, sampleRate: 16000 }));
  };

  socket.onmessage = (event) => {
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(String(event.data)) as Record<string, unknown>;
    } catch {
      return;
    }
    switch (frame.type) {
      case "started":
        handlers.onState?.("live");
        break;
      case "partial":
        if (typeof frame.text === "string") handlers.onPartial?.(frame.text);
        break;
      case "final":
        if (typeof frame.text === "string") {
          handlers.onFinal?.(frame.text, typeof frame.translated === "string" ? frame.translated : "");
        }
        break;
      case "error": {
        const code = typeof frame.code === "string" ? frame.code : "UPSTREAM_ERROR";
        const message = typeof frame.message === "string" ? frame.message : "Real-time translation hit a problem.";
        const fatal = stopped || FATAL_CODES.has(code);
        handlers.onError?.(code, message, fatal);
        if (fatal && !stopped) {
          closedByUs = true;
          handlers.onState?.("idle");
          try {
            socket.close();
          } catch {
            /* already closing */
          }
        }
        break;
      }
      case "stopped":
        handlers.onState?.("idle");
        break;
      default:
        break;
    }
  };

  socket.onerror = () => {
    if (!closedByUs && !stopped) {
      handlers.onError?.("NETWORK", "The real-time connection failed. Check your internet and try again.", true);
    }
  };

  socket.onclose = () => {
    handlers.onState?.("idle");
  };

  return {
    sendAudioChunk: (base64Pcm: string) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ type: "audio", data: base64Pcm }));
      }
    },
    stop: () => {
      stopped = true;
      if (socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING) {
        try {
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify({ type: "stop" }));
          }
          closedByUs = true;
          socket.close();
        } catch {
          /* nothing to do */
        }
      }
      handlers.onState?.("idle");
    },
  };
}
