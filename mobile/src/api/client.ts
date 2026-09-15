import { useSettings } from "../store/settings";
import { ApiError } from "./errors";

export interface TranscribeResponse {
  text: string;
  lang: string;
  confidence: number | null;
  provider: string;
  mock: boolean;
}

export interface TranslateResponse {
  translated: string;
  provider: string;
  mock: boolean;
}

export interface TtsResponse {
  audioBase64: string;
  mimeType: string;
  provider: string;
  mock: boolean;
}

const TIMEOUT_MS = 25_000;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = useSettings.getState().proxyUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const err = (parsed as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(
        err?.code ?? "UPSTREAM_ERROR",
        err?.message ?? "The translation service reported a problem. Please try again.",
        res.status,
      );
    }
    return parsed as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError(
        "TIMEOUT",
        "The translation service took too long to respond. Check your connection and try again.",
        0,
      );
    }
    throw new ApiError(
      "NETWORK",
      "Can't reach the translation service. Check your internet connection (and that the VUGA proxy is running).",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function transcribe(audioBase64: string, languageCode: string): Promise<TranscribeResponse> {
  return postJson<TranscribeResponse>("/api/transcribe", { audio: audioBase64, languageCode });
}

export function translate(text: string, sourceLang: string, targetLang: string): Promise<TranslateResponse> {
  return postJson<TranslateResponse>("/api/translate", { text, sourceLang, targetLang });
}

export function tts(text: string, languageCode: string): Promise<TtsResponse> {
  return postJson<TtsResponse>("/api/tts", { text, languageCode });
}
