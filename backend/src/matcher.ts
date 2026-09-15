import corrections from "../../corrections.json" with { type: "json" };

export interface CorrectionEntry {
  id: string;
  wrong: string;
  right: string;
  tip: string;
  maxDistance?: number;
  /** V3: topic/category (additive; absent in pre-V3 copies of corrections.json). */
  topic?: string;
}

export const CORRECTIONS = corrections as CorrectionEntry[];

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[n] as number;
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

export function findCorrection(transcript: string): { entry: CorrectionEntry; matched: string } | null {
  const words = transcript.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  for (const word of words) {
    for (const entry of CORRECTIONS) {
      if (word === entry.wrong.toLowerCase()) {
        return { entry, matched: word };
      }
    }
  }
  for (const word of words) {
    if (isNearCorrectForm(word)) continue;
    for (const entry of CORRECTIONS) {
      const max = entry.maxDistance ?? 1;
      if (max > 0 && levenshtein(word, entry.wrong.toLowerCase()) <= max) {
        return { entry, matched: word };
      }
    }
  }
  return null;
}
