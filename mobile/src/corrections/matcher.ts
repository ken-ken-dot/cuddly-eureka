import { CORRECTIONS, topicFor } from "./data";
import { levenshtein } from "./levenshtein";

export interface CorrectionHit {
  entryId: string;
  wrong: string;
  right: string;
  tip: string;
  matched: string;
  /** V3: topic/category of the matched entry. */
  topic: string;
}

function isNearCorrectForm(word: string): boolean {
  for (const entry of CORRECTIONS) {
    const right = entry.right.toLowerCase();
    if (word === right) return true;
    if (Math.abs(word.length - right.length) <= 1 && levenshtein(word, right) <= 1) {
      return true;
    }
  }
  return false;
}

/**
 * Same rules as the backend matcher:
 * 1. exact match on a known wrong form always fires;
 * 2. fuzzy match fires only when the word is not near a correct form.
 * Deliberate V1 limitation: only catches mistakes already in the list.
 */
export function findCorrection(transcript: string): CorrectionHit | null {
  const words = transcript.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  for (const word of words) {
    for (const entry of CORRECTIONS) {
      if (word === entry.wrong.toLowerCase()) return toHit(entry, word);
    }
  }
  for (const word of words) {
    if (isNearCorrectForm(word)) continue;
    for (const entry of CORRECTIONS) {
      const max = entry.maxDistance ?? 1;
      if (max > 0 && levenshtein(word, entry.wrong.toLowerCase()) <= max) {
        return toHit(entry, word);
      }
    }
  }
  return null;
}

function toHit(e: (typeof CORRECTIONS)[number], matched: string): CorrectionHit {
  return { entryId: e.id, wrong: e.wrong, right: e.right, tip: e.tip, matched, topic: topicFor(e) };
}
