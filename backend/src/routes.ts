import { Router } from "express";
import { TranscribeBody, TranslateBody, TtsBody } from "./schemas.js";
import { makeCompiler } from "./validation.js";
import { runTranscribe, runTranslate, runTts } from "./providers.js";
import { isSupportedLanguage, normalizeLanguageCode } from "./languages.js";
import { config } from "./config.js";
import { googleConfigured } from "./config.js";

export const api = Router();

const parseTranscribe = makeCompiler<{ audio: string; languageCode: string }>(TranscribeBody);
const parseTranslate = makeCompiler<{ text: string; sourceLang: string; targetLang: string }>(TranslateBody);
const parseTts = makeCompiler<{ text: string; languageCode: string }>(TtsBody);

function fail(res: import("express").Response, err: unknown) {
  const e = err as Error & { statusCode?: number; code?: string };
  const status = typeof e.statusCode === "number" ? e.statusCode : 502;
  const code = e.code ?? (status === 502 ? "UPSTREAM_ERROR" : "REQUEST_ERROR");
  console.error(`[vuga-proxy] ${code} (${status}):`, e.message);
  res.status(status).json({
    error: {
      code,
      message: friendlyMessage(code, e),
    },
  });
}

function friendlyMessage(code: string, e: Error & { grpcStatus?: string }): string {
  switch (code) {
    case "NO_SPEECH":
      return "No speech was detected. Try holding the device closer and speaking again.";
    case "UPSTREAM_TIMEOUT":
      return "The translation service took too long to respond. Please try again.";
    case "UNSUPPORTED_LANGUAGE":
      return "That language is not supported yet. V1 supports Kinyarwanda and Mandarin.";
    case "PROVIDER_NOT_CONFIGURED":
      return "The server has no translation provider configured. Set GOOGLE_APPLICATION_CREDENTIALS_JSON.";
    default:
      return e.message || "Something went wrong contacting the translation service.";
  }
}

function pickLanguage(raw: unknown): string {
  const normalized = normalizeLanguageCode(raw);
  if (!normalized) {
    throw Object.assign(new Error(`Unsupported language code: ${String(raw)}`), {
      statusCode: 400,
      code: "UNSUPPORTED_LANGUAGE",
    });
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

api.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: config.provider,
    googleConfigured: googleConfigured(),
    time: new Date().toISOString(),
  });
});

api.get("/languages", (_req, res) => {
  res.json({ languages: [{ code: "rw" }, { code: "zh-CN" }], pairsLocked: true });
});

api.post("/transcribe", async (req, res) => {
  try {
    const body = parseTranscribe(req.body);
    const languageCode = pickLanguage(body.languageCode);
    const result = await runTranscribe(body.audio, languageCode);
    res.json(result);
  } catch (err) {
    fail(res, err);
  }
});

api.post("/translate", async (req, res) => {
  try {
    const body = parseTranslate(req.body);
    const sourceLang = pickLanguage(body.sourceLang);
    const targetLang = pickLanguage(body.targetLang);
    const text = body.text.trim();
    if (!text) {
      res.status(400).json({ error: { code: "EMPTY_TEXT", message: "Nothing to translate." } });
      return;
    }
    const result = await runTranslate(text, sourceLang, targetLang);
    res.json(result);
  } catch (err) {
    fail(res, err);
  }
});

api.post("/tts", async (req, res) => {
  try {
    const body = parseTts(req.body);
    const languageCode = pickLanguage(body.languageCode);
    const result = await runTts(body.text, languageCode);
    res.json(result);
  } catch (err) {
    fail(res, err);
  }
});
