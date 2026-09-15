import { CORRECTIONS, topicFor } from "./data";
import { findCorrection, type CorrectionHit } from "./matcher";
import { useCorrections } from "../store/corrections";
import { useTracking } from "./tracking";

/**
 * V3 typed-text coaching — extends the existing correction-list logic to typed
 * input (per the V3 brief: "extending the existing correction-list logic to
 * typed input, not a separate system").
 *
 * For a typed phrase in Kinyarwanda it answers, using only the same curated
 * list the spoken matcher uses:
 *   - was anything in it a known mistake? → the same Ticket the spoken flow
 *     shows, plus the topic it belongs to;
 *   - otherwise, which topic does the phrase belong to, and how many clean
 *     exchanges have there been in that topic since the last kept mistake?
 *
 * The "level of what you typed" is deliberately a progress-indicator level
 * (the same 0–3 labels as Learn's breakdown) — never a fluency judgment about
 * one sentence. A phrase with no known mistake in it is not "correct
 * Kinyarwanda"; it just contains nothing the curated list can see (the same
 * honest coverage caveat V1's Learn empty-state already carries).
 */

export type CoachKind = "mistake" | "clean";

export interface CoachingResult {
  kind: CoachKind;
  /** Present for kind === "mistake". */
  hit?: CorrectionHit;
  /** Present for kind === "clean". */
  topic?: string;
  /** Present for kind === "clean" — clean exchanges in this topic so far. */
  clean?: number;
  /** Present for kind === "clean". */
  level?: 0 | 1 | 2 | 3;
  /** Present for kind === "clean" — the level label used in the ticket copy. */
  levelText?: string;
  /** One-line honest framing shown in the ticket. */
  line: string;
  /** Actionable tip, reusing the curated entry's tip where one exists. */
  tip: string;
  /** True when this exact phrase was coached before (kept as a correction). */
  practicedBefore: boolean;
}

const TOPIC_HINTS: ReadonlyArray<{ words: string[]; topic: string }> = [
  { words: ["muraho", "murakoze", "amakuru", "mwaramutse", "mwiriwe", "murawo", "murakoce", "murakose"], topic: "greetings" },
  { words: ["amafaranga", "amaranga", "amafarang", "sahani", "ihauri", "limbere", "akayira"], topic: "money" },
  { words: ["angahe", "amangahe", "igiciro", "igichiro", "igitciro", "agaciro"], topic: "prices" },
  { words: ["kugura", "kugulwa", "kugurisha", "kugurisa", "gucuruza", "agacurabwenge"], topic: "buying-selling" },
  { words: ["imboga", "imboka", "imbuto", "impbuto", "amazi", "amajzi", "umuceri", "umucheri", "umugati", "umkati", "inyama", "inyamba", "intungu", "untugu", "ibirayi", "ibirai", "umuneke", "umunek", "isukari", "isukali", "amata", "amatta", "inkoko", "inkok", "ihene", "ihenne", "ibishyimbo", "ibishimbo", "ikawa", "igawa", "icyayi", "icyaji", "umunyu", "ubuki", "ubugi"], topic: "food-produce" },
  { words: ["gitoya", "gito", "irahende", "irahennde", "urungu", "urwunga", "nini", "ngari"], topic: "describing-things" },
];

/** Topic for a phrase with no mistake in it: the topic of the first curated
 * vocabulary the phrase contains (right forms first, then wrong forms, so a
 * phrase built from correct words is attributed honestly), else "general". */
export function topicForText(text: string): string {
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  for (const word of words) {
    for (const entry of CORRECTIONS) {
      if (word === entry.right.toLowerCase()) return topicFor(entry);
    }
  }
  for (const word of words) {
    for (const hint of TOPIC_HINTS) {
      if (hint.words.includes(word)) return hint.topic;
    }
  }
  for (const word of words) {
    for (const entry of CORRECTIONS) {
      if (word === entry.wrong.toLowerCase()) return topicFor(entry);
    }
  }
  return "general";
}

/** Same ordinal labels as the proficiency breakdown — no assessment language. */
const LEVEL_TEXT = ["just starting", "getting there", "nearly solid", "solid in this topic"] as const;

/** Clean-exchange volume for a topic, read from the same proficiency report
 * the Learn breakdown shows — one source of truth, no duplicated math. */
function topicStats(topic: string): { clean: number; level: 0 | 1 | 2 | 3 } | undefined {
  const tracking = useTracking.getState();
  const report = tracking.report ?? tracking.recompute();
  return report.topics.find((tp) => tp.topic === topic);
}

export function coachTypedPhrase(text: string): CoachingResult {
  const hit = findCorrection(text);
  const practicedBefore = hit
    ? useCorrections.getState().corrections.some((r) => r.entryId === hit.entryId)
    : false;

  if (hit) {
    return {
      kind: "mistake",
      hit,
      line: "Known slip in this phrase — same fix as on the mic.",
      tip: hit.tip,
      practicedBefore,
    };
  }

  const topic = topicForText(text);
  const stats = topicStats(topic);
  const clean = stats?.clean ?? 0;
  const level = stats?.level ?? 3;
  const levelText = LEVEL_TEXT[level];

  const lines: Record<string, string> = {
    greetings: "Nothing from the curated list showed up in your greeting — keep it up.",
    money: "Nothing from the curated list showed up in your money phrasing — keep it up.",
    prices: "Nothing from the curated list showed up in your price question — keep it up.",
    "buying-selling": "Nothing from the curated list showed up in your buying/selling phrasing — keep it up.",
    "food-produce": "Nothing from the curated list showed up in your produce vocabulary — keep it up.",
    "describing-things": "Nothing from the curated list showed up in your describing words — keep it up.",
    general: "Nothing from the curated list showed up here — keep it up.",
  };

  return {
    kind: "clean",
    topic,
    clean,
    level,
    levelText,
    line: lines[topic] ?? lines["general"]!,
    tip: `Practice tip: type another ${topic === "general" ? "market phrase" : topic.replace("-", " ")} phrase to build volume in this topic.`,
    practicedBefore: false,
  };
}
