/**
 * Language catalog for V1.
 *
 * V1 is intentionally locked to the Kinyarwanda ⇄ Mandarin pair (product
 * decision), but the catalog shape is designed so V2's universal mode can add
 * languages without touching call sites.
 */

export interface Language {
  /** BCP-47-ish code sent to the proxy. */
  code: string;
  /** English display name. */
  name: string;
  /** Short label shown inside pills/buttons. */
  short: string;
  /** Native name, shown where space allows. */
  native: string;
}

export const KINYARWANDA: Language = {
  code: "rw",
  name: "Kinyarwanda",
  short: "KIN",
  native: "Ikinyarwanda",
};

export const MANDARIN: Language = {
  code: "zh-CN",
  name: "Mandarin",
  short: "ZH",
  native: "普通话",
};

export const LANGUAGES: readonly Language[] = [KINYARWANDA, MANDARIN];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

export function isSupportedLanguage(code: unknown): code is string {
  return typeof code === "string" && BY_CODE.has(code);
}

export function normalizeLanguageCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "zh" || trimmed.toLowerCase() === "zh-cn") return "zh-CN";
  if (trimmed.toLowerCase() === "rw") return "rw";
  return null;
}

export function languageName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

/** The one locked V1 pair. */
export const V1_PAIR = { source: KINYARWANDA, target: MANDARIN } as const;
