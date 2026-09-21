/**
 * Simplified SM-2 (the algorithm behind Anki) — brief Section 3. Pure
 * functions only, no I/O, so it is unit-testable and auditable.
 *
 * Each kept correction carries scheduling state:
 *   ease_factor     (starts 2.5, floor 1.3)
 *   interval_days   (starts 1)
 *   next_review_at  (now + interval_days)
 *   review_count    (times reviewed)
 *
 * Quality mapping for a two-answer drill (brief's two outcomes):
 *   correct → q=5: interval *= ease, ease += 0.10 (capped 2.8)
 *   wrong   → q=2: interval resets to 1, ease -= 0.20 (floor 1.3)
 *
 * This is deliberately the brief's simplified form of SM-2 — no sub-1-day
 * learning steps, no q=0..5 matrix in the UI. One source of truth, shared
 * semantics for tests and routes.
 */

export const EASE_START = 2.5;
export const EASE_FLOOR = 1.3;
export const EASE_CAP = 2.8;
export const INTERVAL_START_DAYS = 1;

export interface ScheduleState {
  easeFactor: number;
  intervalDays: number;
}

export type DrillOutcome = "correct" | "wrong";

export interface ScheduleUpdate {
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: Date;
}

export function initialSchedule(): ScheduleState {
  return { easeFactor: EASE_START, intervalDays: INTERVAL_START_DAYS };
}

/** Round to 2dp to keep numeric(4,2) tidy and tests deterministic. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * SM-2 update for one review. `now` is injectable for tests; production
 * callers pass new Date(). The returned nextReviewAt is always in the future
 * relative to `now` (>= now + 1 day after a lapse), never in the past.
 */
export function nextSchedule(state: ScheduleState, outcome: DrillOutcome, now: Date): ScheduleUpdate {
  const ease = state.easeFactor;
  if (outcome === "correct") {
    const newEase = round2(Math.min(EASE_CAP, ease + 0.1));
    const newInterval = Math.max(1, Math.round(state.intervalDays * ease));
    return {
      easeFactor: newEase,
      intervalDays: newInterval,
      nextReviewAt: new Date(now.getTime() + newInterval * 86_400_000),
    };
  }
  // wrong: interval resets, ease drops with a floor so it never approaches 0.
  const newEase = round2(Math.max(EASE_FLOOR, ease - 0.2));
  return {
    easeFactor: newEase,
    intervalDays: INTERVAL_START_DAYS,
    nextReviewAt: new Date(now.getTime() + INTERVAL_START_DAYS * 86_400_000),
  };
}
