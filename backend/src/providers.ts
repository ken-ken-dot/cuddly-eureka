import { config, googleConfigured } from "./config.js";
import { MANDARIN, V1_PAIR } from "./languages.js";
import * as google from "./google/api.js";

export interface TranscribeResult {
  text: string;
  lang: string;
  confidence: number | null;
  provider: string;
  mock: boolean;
}

export interface TranslateResult {
  translated: string;
  provider: string;
  mock: boolean;
}

export interface TtsResult {
  audioBase64: string;
  mimeType: string;
  provider: string;
  mock: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const V1_DEFAULT_PAIR = V1_PAIR;

function trimAudio(audio: string): string {
  return audio.trim();
}

// ---------------------------------------------------------------------------
// Mock implementations — deterministic, dependency-free, no network
// ---------------------------------------------------------------------------

const MOCK_TRANSLATIONS: ReadonlyMap<string, string> = new Map([
  ["amafaranga", "钱"],
  ["uburaya", "欧洲"],
  ["muraho", "你好"],
  ["murakoze", "谢谢"],
  ["amakuru", "近况如何？"],
  ["ni meza", "我很好"],
  ["ubusa", "免费"],
  ["umuzungu", "外国人"],
  ["igiciro", "价格"],
  ["cyamukoroshe", "公道的"],
]);

function mockTranscribe(audioBase64: string, languageCode: string): TranscribeResult {
  const byteLen = Buffer.byteLength(audioBase64, "base64");
  if (byteLen < 64) {
    throw Object.assign(new Error("Mock mode received no intelligible audio"), {
      statusCode: 422,
      code: "NO_SPEECH",
    });
  }
  // Deterministic fake transcript so UI flows can be exercised without keys.
  return { text: mockTranscriptFor(languageCode), lang: languageCode, confidence: 0.86, provider: "mock", mock: true };
}

/** Deterministic placeholder transcript per language (mock mode only).
 *  rw/zh outputs are byte-identical to V1; en/de were rejected at the route
 *  layer before the multilingual brief, so nothing existing changes. */
export function mockTranscriptFor(languageCode: string): string {
  switch (languageCode) {
    case MANDARIN.code:
      return "你好，我要买一些水果。";
    case "en":
      return "Hello, I would like to buy some vegetables.";
    case "de":
      return "Hallo, ich möchte etwas Gemüse kaufen.";
    default:
      return "Muraho, nshaka kugura imboga.";
  }
}

function mockTranslate(text: string, targetLang: string): TranslateResult {
  const lower = text.toLowerCase();
  let translated = lower;
  for (const [k, v] of MOCK_TRANSLATIONS) {
    if (lower.includes(k)) {
      translated = v;
      break;
    }
  }
  if (targetLang.startsWith("zh")) {
    // keep mock output distinct from a real translation
    translated = `〔模拟〕${translated}`;
  }
  return { translated, provider: "mock", mock: true };
}

const MOCK_TTS_PHRASES: ReadonlyMap<string, string> = new Map([
  ["你好", "mock-zh-tts-bytes"],
  ["谢谢", "mock-zh-tts-bytes"],
]);

function mockTts(text: string, languageCode: string): TtsResult {
  const key = text.trim();
  const known = [...MOCK_TTS_PHRASES.keys()].find((p) => key.includes(p));
  if (!known && languageCode.startsWith("zh")) {
    throw new Error("MOCK_TTS_UNSUPPORTED: add this phrase to MOCK_TTS_PHRASES for demo audio");
  }
  return {
    audioBase64: Buffer.from(known ? MOCK_TTS_PHRASES.get(known)! : key).toString("base64"),
    mimeType: "audio/mp3",
    provider: "mock",
    mock: true,
  };
}

// ---------------------------------------------------------------------------
// Public provider API — switches on config
// ---------------------------------------------------------------------------

export async function runTranscribe(audioBase64: string, languageCode: string): Promise<TranscribeResult> {
  const audio = trimAudio(audioBase64);
  if (!audio) {
    throw Object.assign(new Error("Audio payload is empty"), { statusCode: 400 });
  }
  if (config.provider === "mock") {
    await sleep(config.mockLatencyMs);
    return mockTranscribe(audio, languageCode);
  }
  if (!googleConfigured()) {
    throw Object.assign(new Error("Google provider selected but credentials are missing"), { statusCode: 500 });
  }

  // Boost recognition of market-vendor vocabulary.
  const phrases = [...MOCK_TRANSLATIONS.keys()].map((phrase) => ({ phrase, boost: 10 }));
  const { text, confidence } = await google.transcribeBatch({
    base64Audio: audio,
    languageCode,
    phrases,
  });
  if (!text) {
    throw Object.assign(new Error("No speech detected in the recording"), { statusCode: 422, code: "NO_SPEECH" });
  }
  return { text, lang: languageCode, confidence, provider: "google", mock: false };
}

export async function runTranslate(text: string, sourceLang: string, targetLang: string): Promise<TranslateResult> {
  if (config.provider === "mock") {
    await sleep(config.mockLatencyMs);
    return mockTranslate(text, targetLang);
  }
  if (!googleConfigured()) {
    throw Object.assign(new Error("Google provider selected but credentials are missing"), { statusCode: 500 });
  }
  const { translated } = await google.translateText({ text, sourceLang, targetLang });
  return { translated, provider: "google", mock: false };
}

export async function runTts(text: string, languageCode: string): Promise<TtsResult> {
  if (config.provider === "mock") {
    return mockTts(text, languageCode);
  }
  if (!googleConfigured()) {
    throw Object.assign(new Error("Google provider selected but credentials are missing"), { statusCode: 500 });
  }
  const out = await google.synthesizeSpeech({ text, languageCode });
  return { ...out, provider: "google", mock: false };
}


