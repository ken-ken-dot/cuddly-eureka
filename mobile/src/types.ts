export type Speaker = "you" | "them";

export interface CorrectionInfo {
  wrong: string;
  right: string;
  tip: string;
  /** V3: curated entry id (absent on V1/V2 turns) — used for keep attribution. */
  entryId?: string;
}

/** V3: coaching output attached to typed-text turns (see corrections/coaching.ts).
 * For kind "mistake" the wrong/right/entryId/matched fields are populated and
 * the phrase is rendered exactly like a spoken-correction Ticket; for kind
 * "clean" the topic/level fields describe the progress signal instead. */
export interface CoachingInfo {
  kind: "mistake" | "clean";
  wrong?: string;
  right?: string;
  tip: string;
  entryId?: string;
  matched?: string;
  topic?: string;
  clean?: number;
  level?: 0 | 1 | 2 | 3;
  levelText?: string;
  line: string;
  practicedBefore: boolean;
}

/** One alternating transcript turn on the Translate screen. */
export interface Turn {
  id: string;
  speaker: Speaker;
  original: string;
  translated: string;
  correction?: CorrectionInfo;
  /** V3: topic of the correction's curated entry (absent on V1/V2 turns). */
  topic?: string;
  /** V3: typed-text coaching, set only on typed "you" turns in Kinyarwanda. */
  coaching?: CoachingInfo;
  /** Set once the correction has been kept to Learn. */
  keptId?: string;
  at: number;
}

/**
 * Translation pairs. The two V1 values stay first and behave exactly as
 * before (LanguageToggle renders them unchanged); the multilingual brief adds
 * four more verified pairs. Pair codes are source-target using the proxy's
 * translation codes (rw, zh-CN, en, de).
 */
export type Direction = "rw-zh" | "zh-rw" | "rw-en" | "en-rw" | "rw-de" | "de-rw" | "en-de" | "de-en";

export const DIRECTIONS: readonly Direction[] = [
  "rw-zh",
  "zh-rw",
  "rw-en",
  "en-rw",
  "rw-de",
  "de-rw",
  "en-de",
  "de-en",
];

/** Translation-API codes per pair side (match backend normalizeLanguageCode). */
const CODE_FOR_LABEL: Readonly<Record<string, string>> = {
  rw: "rw",
  zh: "zh-CN",
  en: "en",
  de: "de",
};

/** Native names shown in the picker, keyed by pair-side label. */
export const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  rw: "Kinyarwanda",
  zh: "普通话",
  en: "English",
  de: "Deutsch",
};

export function directionLanguages(d: Direction): { source: string; target: string } {
  const [s = "", t = ""] = d.split("-");
  return { source: CODE_FOR_LABEL[s] ?? s, target: CODE_FOR_LABEL[t] ?? t };
}

/** Short side label used by the picker pills (KIN / ZH / EN / DE). */
export function directionSideLabel(side: string): string {
  return { rw: "KIN", zh: "ZH", en: "EN", de: "DE" }[side] ?? side.toUpperCase();
}

export function directionLabel(d: Direction): string {
  if (d === "rw-zh") return "Kinyarwanda → 普通话";
  if (d === "zh-rw") return "普通话 → Kinyarwanda";
  const [s = "", t = ""] = d.split("-");
  return `${LANGUAGE_NAMES[s] ?? s} → ${LANGUAGE_NAMES[t] ?? t}`;
}

/** True when the proxy is running with placeholder/mock responses (not real translation). */
export function isMockTranslate(r: { mock: boolean }): boolean {
  return r.mock;
}
