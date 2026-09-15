import { config } from "../config.js";
import { GoogleApiError } from "./errors.js";
import { googlePost } from "./client.js";

export interface SpeechAdaptationPhrase {
  phrase: string;
  boost?: number;
}

/**
 * Speech-to-Text V2: recognize a batch of raw audio.
 * Uses the project-scoped `locations/global/batchRecognize` endpoint, which
 * supports rw-RW with short/long models and returns one transcript per file.
 */
export async function transcribeBatch(params: {
  base64Audio: string;
  languageCode: string;
  phrases?: SpeechAdaptationPhrase[];
}): Promise<{ text: string; confidence: number | null }> {
  const { base64Audio, languageCode, phrases } = params;
  const project = config.google.project;
  const parent = `projects/${project}/locations/global`;

  const body: Record<string, unknown> = {
    config: {
      languageCodes: [languageCode],
      model: "long",
      autoDecodingConfig: {}, // let Google detect WAV/MP3/OGG etc.
      ...(phrases && phrases.length > 0
        ? { adaptation: { phraseSets: [{ phrases: phrases.map((p) => ({ phrase: p.phrase, boost: p.boost ?? 10 })) }] } }
        : {}),
    },
    files: [{ config: {}, content: base64Audio }],
  };

  const res = await googlePost<{
    results?: Record<string, { transcript?: { alternatives?: Array<{ transcript?: string; confidence?: number }> } }>;
  }>(`https://speech.googleapis.com/v2/${parent}:batchRecognize`, body);

  // batchRecognize returns results keyed by file index ("0" for inline content).
  const firstResult = res.results ? Object.values(res.results)[0] : undefined;
  const first = firstResult?.transcript?.alternatives?.[0];
  const text = (first?.transcript ?? "").trim();
  const confidence = typeof first?.confidence === "number" ? first.confidence : null;
  return { text, confidence };
}

/** Cloud Translation API v2 (NMT engine — the one that actually lists `rw`). */
export async function translateText(params: {
  text: string;
  sourceLang: string;
  targetLang: string;
  format?: "text" | "html";
}): Promise<{ translated: string; detectedSource: string | null }> {
  const res = await googlePost<{
    data?: {
      translations?: Array<{ translatedText?: string; detectedSourceLanguage?: string }>;
    };
  }>("https://translation.googleapis.com/language/translate/v2", {
    q: params.text,
    source: params.sourceLang,
    target: params.targetLang,
    format: params.format ?? "text",
  });

  const t = res.data?.translations?.[0];
  if (!t?.translatedText) {
    throw new GoogleApiError("Google Translate returned no translation", 502);
  }
  return {
    translated: t.translatedText,
    detectedSource: t.detectedSourceLanguage ?? null,
  };
}

/** Cloud Text-to-Speech: synthesize speech for voice output of translations. */
export async function synthesizeSpeech(params: {
  text: string;
  languageCode: string;
}): Promise<{ audioBase64: string; mimeType: string }> {
  const res = await googlePost<{ audioContent?: string }>(
    "https://texttospeech.googleapis.com/v1/text:synthesize",
    {
      input: { text: params.text },
      voice: { languageCode: params.languageCode },
      audioConfig: { audioEncoding: "MP3" },
    },
  );
  if (!res.audioContent) {
    throw new GoogleApiError("Google TTS returned no audio", 502);
  }
  return { audioBase64: res.audioContent, mimeType: "audio/mp3" };
}
