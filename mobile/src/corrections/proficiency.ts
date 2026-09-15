/**
 * V3 proficiency heuristic — a transparent progress indicator, NOT a language
 * assessment. There is no CEFR-style model for Kinyarwanda here; this derives
 * per-topic levels from the user's own observable history:
 *
 *   - kept corrections per topic (mistakes, from the curated list's topic tags)
 *   - repeat-mistake rate (same wrong form kept more than once)
 *   - volume of successful (uncorrected) exchanges
 *
 * Deliberately honest limits, mirrored in the UI:
 *   - it only sees mistakes that exist in the curated list (see Learn's note);
 *   - it measures activity on this device, not certified fluency;
 *   - no level names that imply formal assessment ("B1", "fluent").
 *
 * Pure functions only — no React, no storage, no imports beyond the correction
 * data — so it can be unit-tested and reasoned about.
 */

import { CORRECTIONS, DEFAULT_TOPIC, topicFor } from "./data";
import type { CorrectionRecord } from "../store/corrections";

export type LevelId = 0 | 1 | 2 | 3;

export interface TopicStats {
  topic: string;
  /** Distinct wrong forms kept in this topic. */
  mistakes: number;
  /** Extra kept records for wrong forms kept more than once (repeat signal). */
  repeats: number;
  /** Successful (uncorrected) exchanges attributed to this topic. */
  clean: number;
  level: LevelId;
}

export interface ProficiencyReport {
  /** 0..1 aggregate across practiced topics; the number behind the progress bar. */
  score: number;
  level: LevelId;
  topics: TopicStats[];
}

/** A single "user spoke or typed in Kinyarwanda" event, in chronological order. */
export interface HistoryEntry {
  at: number;
  /** True when the matcher fired on this exchange. */
  hadMistake: boolean;
  /** Curated entry id of the mistake, when hadMistake is true. */
  entryId?: string;
  /** Topic carried by the session for this exchange (typed turn or kept record). */
  topic?: string;
}

/** Levels are ordinal "attention" stages — no assessment language. */
export const LEVEL_LABELS = ["Just starting", "Getting there", "Nearly solid", "Solid"] as const;

export function levelLabel(level: LevelId): string {
  return LEVEL_LABELS[level];
}

/** Cap on the trailing, still-open streak of clean exchanges (no next mistake
 * has closed it), so one quiet evening can't max out a topic. */
const MAX_OPEN_STREAK = 10;

/** Level derived from a topic's signals. Deliberately simple and legible. */
function levelFor(mistakes: number, repeats: number, clean: number): LevelId {
  // Repeats are the strongest "needs attention" signal.
  if (mistakes === 0) return 3; // nothing needs attention in this topic
  if (repeats >= 2) return 0;
  if (mistakes >= 3) return 0;
  if (mistakes === 2) return 1;
  return clean >= 3 ? 2 : 1; // one mistake: attention drops as clean exchanges pile up
}

/** Aggregate level: average of topic levels (topics with no data are skipped,
 * so the aggregate only reflects topics the user has actually practiced). */
function aggregate(topics: TopicStats[]): { score: number; level: LevelId } {
  const withData = topics.filter((tp) => tp.mistakes > 0 || tp.clean > 0);
  if (withData.length === 0) return { score: 0, level: 3 };
  const avg = withData.reduce((sum, tp) => sum + tp.level, 0) / withData.length;
  return { score: avg / 3, level: Math.round(avg) as LevelId };
}

/** Resolve a kept record to a curated entry: by entryId first, then by its
 * (wrong, right) pair. Only curated mistakes count — keeps the heuristic honest
 * about what it can see. */
function entryForRecord(r: CorrectionRecord): (typeof CORRECTIONS)[number] | undefined {
  if (r.entryId) {
    const byId = CORRECTIONS.find((e) => e.id === r.entryId);
    if (byId) return byId;
  }
  return CORRECTIONS.find(
    (e) => e.wrong.toLowerCase() === r.wrong.toLowerCase() && e.right.toLowerCase() === r.right.toLowerCase(),
  );
}

function topicOfRecord(r: CorrectionRecord): string {
  if (r.topic && r.topic.trim()) return r.topic.trim();
  const entry = entryForRecord(r);
  return entry ? topicFor(entry) : DEFAULT_TOPIC;
}

export function computeProficiency(
  corrections: readonly CorrectionRecord[],
  history: readonly HistoryEntry[],
): ProficiencyReport {
  // Topic list = union of curated topics and topics seen in kept records.
  const topics = new Set<string>(CORRECTIONS.map(topicFor));
  for (const r of corrections) topics.add(topicOfRecord(r));

  // Mistakes per topic: distinct curated wrong forms kept.
  // Repeats: extra kept records for a form already counted (same wrong form
  // kept more than once), per topic.
  const perTopic = new Map<string, TopicStats>();
  for (const topic of topics) {
    perTopic.set(topic, { topic, mistakes: 0, repeats: 0, clean: 0, level: 3 });
  }
  const formsPerTopic = new Map<string, Set<string>>();
  for (const r of corrections) {
    const entry = entryForRecord(r);
    if (!entry) continue; // not in the curated list — the heuristic can't see it
    const topic = topicOfRecord(r);
    const key = entry.wrong.toLowerCase();
    const forms = formsPerTopic.get(topic) ?? new Set<string>();
    if (forms.has(key)) {
      const stat = perTopic.get(topic);
      if (stat) stat.repeats += 1;
    } else {
      forms.add(key);
      formsPerTopic.set(topic, forms);
      const stat = perTopic.get(topic);
      if (stat) stat.mistakes += 1;
    }
  }

  // Clean exchanges: every "you" exchange in Kinyarwanda (spoken or typed)
  // between one mistake and the next. A mistake closes the streak in its own
  // topic and opens a fresh one; the trailing, unclosed streak counts up to
  // MAX_OPEN_STREAK. Exchanges before the first mistake have nothing to be
  // "clean since", so they stay uncounted.
  //
  // The timeline merges two sources of mistake boundaries: live mistakes from
  // the history log, and kept records. The two usually describe the same
  // mistake (the keep happens right after the turn), so kept records that land
  // within KEEP_DEDUPE_MS of a same-form live event add no second boundary —
  // otherwise one real mistake would split one clean streak into two capped
  // halves and understate the user's progress.
  const KEEP_DEDUPE_MS = 5 * 60 * 1000;
  interface Boundary {
    at: number;
    formKey: string;
    topic: string;
  }
  const eventBoundaries: Boundary[] = [];
  for (const h of history) {
    if (!h.hadMistake || !h.entryId) continue;
    const entry = CORRECTIONS.find((e) => e.id === h.entryId);
    if (!entry) continue;
    eventBoundaries.push({
      at: h.at,
      formKey: entry.wrong.toLowerCase(),
      topic: h.topic?.trim() || topicFor(entry),
    });
  }
  const recordBoundaries: Boundary[] = [];
  for (const r of corrections) {
    const entry = entryForRecord(r);
    if (!entry) continue;
    recordBoundaries.push({
      at: r.createdAt,
      formKey: entry.wrong.toLowerCase(),
      topic: topicOfRecord(r),
    });
  }
  const mistakes: Array<{ at: number; topic: string }> = recordBoundaries
    .filter(
      (rb) =>
        !eventBoundaries.some(
          (eb) => eb.formKey === rb.formKey && rb.at >= eb.at && rb.at - eb.at <= KEEP_DEDUPE_MS,
        ),
    )
    .map((b) => ({ at: b.at, topic: b.topic }))
    .concat(eventBoundaries.map((b) => ({ at: b.at, topic: b.topic })))
    .sort((a, b) => a.at - b.at);

  // Single chronological walk over clean events and mistake boundaries.
  const cleanEvents = history.filter((h) => !h.hadMistake).map((h) => ({ at: h.at })).sort((a, b) => a.at - b.at);
  let mi = 0;
  let lastMistake: { topic: string } | null = null;
  let streakTopic: string | null = null;
  let streak = 0;
  const flush = () => {
    if (streakTopic && streak > 0) {
      const stat = perTopic.get(streakTopic);
      if (stat) stat.clean += Math.min(streak, MAX_OPEN_STREAK);
    }
    streakTopic = null;
    streak = 0;
  };
  for (const c of cleanEvents) {
    while (mi < mistakes.length && mistakes[mi]!.at <= c.at) {
      flush();
      lastMistake = mistakes[mi]!;
      mi += 1;
    }
    if (lastMistake) {
      // Attribute the open streak to the topic of the most recent mistake.
      if (!streakTopic) streakTopic = lastMistake.topic;
      streak += 1;
    }
  }
  // Mistakes after the last clean event still reset the open streak — but the
  // streak was already flushed when it closed, so nothing more to count.
  flush();

  const list = [...perTopic.values()].map((s) => ({
    ...s,
    level: levelFor(s.mistakes, s.repeats, s.clean),
  }));
  const agg = aggregate(list);
  return { score: agg.score, level: agg.level, topics: list };
}
