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

export type Direction = "rw-zh" | "zh-rw";

export const DIRECTIONS: readonly Direction[] = ["rw-zh", "zh-rw"];

export function directionLanguages(d: Direction): { source: string; target: string } {
  return d === "rw-zh" ? { source: "rw", target: "zh-CN" } : { source: "zh-CN", target: "rw" };
}

export function directionLabel(d: Direction): string {
  return d === "rw-zh" ? "Kinyarwanda → 普通话" : "普通话 → Kinyarwanda";
}

/** True when the proxy is running with placeholder/mock responses (not real translation). */
export function isMockTranslate(r: { mock: boolean }): boolean {
  return r.mock;
}
