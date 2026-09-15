import { makeId } from "./ids.js";
import { KINYARWANDA, MANDARIN } from "./languages.js";

export type Speaker = "You" | "Them";

export interface Turn {
  id: string;
  speaker: Speaker;
  original: string;
  originalLang: string;
  translated: string;
  translatedLang: string;
  correction?: {
    wrong: string;
    right: string;
    tip: string;
  };
  createdAt: number;
}

export function makeTurn(speaker: Speaker, original: string, originalLang: string, translated: string, translatedLang: string, correction?: Turn["correction"]): Turn {
  return {
    id: makeId("turn"),
    speaker,
    original,
    originalLang,
    translated,
    translatedLang,
    createdAt: Date.now(),
    ...(correction ? { correction } : {}),
  };
}

export const DEFAULT_SESSION = {
  sourceLang: KINYARWANDA.code,
  targetLang: MANDARIN.code,
};
