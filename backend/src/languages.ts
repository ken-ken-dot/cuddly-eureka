/**
 * Language catalog.
 *
 * V1 shipped locked to Kinyarwanda ⇄ Mandarin. The multilingual brief adds
 * English and German as additive entries — the original pair stays first and
 * behaves exactly as before (V1_PAIR is unchanged and still the default).
 *
 * Codes below are TRANSLATION-API codes (Cloud Translation v2 accepts
 * `rw`, `en`, `de`, `zh-CN` directly). Speech-to-Text V2 uses different,
 * officially-maintained BCP-47 codes — see STT_LANGUAGE_ROUTING below.
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

// Multilingual brief Section 5: additive languages, verified for both STT
// and translation (brief Section 1). Kinyarwanda ⇄ Mandarin remains option
// #1 and the default — nothing about the existing flow changes.
export const ENGLISH: Language = {
  code: "en",
  name: "English",
  short: "EN",
  native: "English",
};

export const GERMAN: Language = {
  code: "de",
  name: "German",
  short: "DE",
  native: "Deutsch",
};

export const LANGUAGES: readonly Language[] = [KINYARWANDA, MANDARIN, ENGLISH, GERMAN];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

export function isSupportedLanguage(code: unknown): code is string {
  return typeof code === "string" && BY_CODE.has(code);
}

export function normalizeLanguageCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === "zh" || lower === "zh-cn") return "zh-CN";
  if (lower === "rw") return "rw";
  if (lower === "en") return "en";
  if (lower === "de") return "de";
  return null;
}

export function languageName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

/** The one locked V1 pair — still the default pair everywhere. */
export const V1_PAIR = { source: KINYARWANDA, target: MANDARIN } as const;

/**
 * Multilingual brief Section 3 — THE region routing table.
 *
 * One explicit lookup per STT language. When a new language is added later,
 * this table is the one place that needs an entry (plus a fresh verification
 * pass like the brief's Section 1). Everything else reads from here.
 *
 *  - `region`: STT V2 endpoint region. Kinyarwanda is verified ONLY in `eu`
 *    (short/long models, no chirp, no auto-punctuation); en/de stream on
 *    `global` with chirp_3.
 *  - `sttCode`: STT V2's officially-maintained BCP-47 code, which differs
 *    from the translation code for Mandarin (`cmn-Hans-CN`, not `zh-CN`).
 *  - `model`: verified streaming-capable model for that language/region.
 */
export interface SttLanguageRouting {
  region: "global" | "eu";
  sttCode: string;
  model: string;
  /** Curated market-vendor phrase boosting works via model adaptation only
   *  on models that list it — rw-RW's `short` model does not, per the
   *  supported-languages page. */
  adaptation: boolean;
}

export const STT_LANGUAGE_ROUTING: ReadonlyMap<string, SttLanguageRouting> = new Map([
  ["rw", { region: "eu", sttCode: "rw-RW", model: "short", adaptation: false }],
  ["zh-CN", { region: "global", sttCode: "cmn-Hans-CN", model: "chirp_3", adaptation: true }],
  ["en", { region: "global", sttCode: "en-US", model: "chirp_3", adaptation: true }],
  ["de", { region: "global", sttCode: "de-DE", model: "chirp_3", adaptation: true }],
] as Array<[string, SttLanguageRouting]>);

/** Routing for a normalized language code, or null when STT is unverified. */
export function sttRoutingFor(code: string): SttLanguageRouting | null {
  return STT_LANGUAGE_ROUTING.get(code) ?? null;
}
