/**
 * Learning-insights math (learning brief Sections 1-2). Pure functions — no
 * React, no storage — mirroring the V3 proficiency module's discipline.
 *
 * Personalization here comes ONLY from data VUGA already has: which curated
 * corrections a user kept, how often, on which topics, how recently. No AI
 * model, no assessment claims — the UI labels stay honest ("needs attention",
 * not scores).
 *
 * Weak-point ranking = frequency + recency (brief §2):
 *   a mistake from yesterday matters more than one from three months ago.
 * Weekly trend = kept mistakes per ISO-ish week (Mon-Sun), last 6 weeks.
 */

import { CORRECTIONS, DEFAULT_TOPIC, topicFor } from "../corrections/data";
import type { CorrectionRecord } from "../store/corrections";

// --- Weak points -------------------------------------------------------------

export interface WeakPoint {
  topic: string;
  /** Distinct wrong forms kept in this topic (curated entries only). */
  distinct: number;
  /** Total kept records in this topic (repeats included). */
  total: number;
  /** Most recent keep of any form in this topic (ms epoch). */
  lastAt: number;
  /** Recency weight in [0,1]: 1 = kept today, decays over ~30 days. */
  recency: number;
  /** score = distinct*2 + repeats, all multiplied by recency (0 when stale). */
  score: number;
}

const DAY_MS = 86_400_000;
const RECENCY_HALFLIFE_DAYS = 14;

/** Exponential recency decay: 1.0 today → ~0.5 at 14 days → ~0.22 at 30. */
export function recencyWeight(lastAt: number, now: number): number {
  const days = Math.max(0, (now - lastAt) / DAY_MS);
  return Math.pow(0.5, days / RECENCY_HALFLIFE_DAYS);
}

/** Resolve a kept record to a curated entry (same rule as V3 proficiency). */
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

/**
 * Rank topics by weakness: frequency (distinct forms + repeat signal) weighted
 * by recency of the most recent mistake. Topics with no curated-visible
 * mistakes never appear (the heuristic can't honestly see anything else).
 */
export function computeWeakPoints(
  corrections: readonly CorrectionRecord[],
  now: number = Date.now(),
): WeakPoint[] {
  interface Acc {
    topic: string;
    forms: Set<string>;
    total: number;
    lastAt: number;
  }
  const acc = new Map<string, Acc>();
  for (const r of corrections) {
    const entry = entryForRecord(r);
    if (!entry) continue; // not in the curated list — can't honestly rank it
    const topic = topicOfRecord(r);
    const a = acc.get(topic) ?? { topic, forms: new Set<string>(), total: 0, lastAt: 0 };
    a.forms.add(entry.wrong.toLowerCase());
    a.total += 1;
    a.lastAt = Math.max(a.lastAt, r.createdAt);
    acc.set(topic, a);
  }

  const points: WeakPoint[] = [];
  for (const a of acc.values()) {
    const distinct = a.forms.size;
    const repeats = a.total - distinct;
    const recency = recencyWeight(a.lastAt, now);
    points.push({
      topic: a.topic,
      distinct,
      total: a.total,
      lastAt: a.lastAt,
      recency,
      score: (distinct * 2 + repeats) * recency,
    });
  }
  // Frequency first; recency breaks ties; recency also fades stale items down
  // the list rather than removing them (they still happened).
  return points.sort(
    (a, b) => b.score - a.score || b.lastAt - a.lastAt || a.topic.localeCompare(b.topic),
  );
}

// --- Weekly trend -------------------------------------------------------------

export interface WeekPoint {
  /** Monday 00:00 local of that week, ms epoch (stable label anchor). */
  weekStart: number;
  keptMistakes: number;
}

/**
 * Kept mistakes per week for the last `weeks` weeks (oldest first, current
 * week last). Local-time weeks starting Monday — deliberately simple and
 * legible, not a statistics library.
 */
export function computeWeeklyTrend(
  corrections: readonly CorrectionRecord[],
  weeks: number = 6,
  now: number = Date.now(),
): WeekPoint[] {
  const startOfCurrentWeek = startOfWeek(now);
  const buckets: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    buckets.push({ weekStart: startOfCurrentWeek - i * 7 * DAY_MS, keptMistakes: 0 });
  }
  const firstStart = buckets[0]!.weekStart;
  for (const r of corrections) {
    if (r.createdAt < firstStart) continue;
    const ws = startOfWeek(r.createdAt);
    const idx = Math.round((ws - firstStart) / (7 * DAY_MS));
    const bucket = buckets[idx];
    if (bucket) bucket.keptMistakes += 1;
  }
  return buckets;
}

function startOfWeek(ms: number): number {
  const d = new Date(ms);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  return d.getTime() - day * DAY_MS;
}

/**
 * Honest trend label for the UI: compares the last COMPLETE week against the
 * weeks before it. The current, still-in-progress week is excluded — mid-week
 * a partial week always looks artificially small/large, which would make the
 * label noisy and dishonest. With little data it says "not enough data yet"
 * instead of inventing a direction.
 */
export function trendLabel(points: readonly WeekPoint[]): string {
  if (points.length < 4) return "Not enough data yet";
  const lastComplete = points[points.length - 2]!.keptMistakes;
  const earlier = points.slice(0, -2);
  const anyData = points.some((p) => p.keptMistakes > 0);
  if (!anyData || (lastComplete === 0 && earlier.every((p) => p.keptMistakes === 0))) {
    return "Not enough data yet";
  }
  const prevAvg = earlier.reduce((s, p) => s + p.keptMistakes, 0) / earlier.length;
  if (prevAvg === 0) return lastComplete > 0 ? "Just getting started" : "Not enough data yet";
  if (lastComplete < prevAvg * 0.75) return "Fewer mistakes than recent weeks";
  if (lastComplete > prevAvg * 1.25) return "More mistakes than recent weeks";
  return "About the same as recent weeks";
}
