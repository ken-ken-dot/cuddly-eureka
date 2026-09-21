import { test } from "node:test";
import assert from "node:assert/strict";

import { nextSchedule, initialSchedule, EASE_FLOOR, EASE_CAP } from "../src/sm2.js";

const now = new Date("2026-09-18T12:00:00Z");
const DAY = 86_400_000;

test("initial state matches the brief's defaults", () => {
  const s = initialSchedule();
  assert.equal(s.easeFactor, 2.5);
  assert.equal(s.intervalDays, 1);
});

test("correct answer multiplies interval by ease and nudges ease up", () => {
  const upd = nextSchedule({ easeFactor: 2.5, intervalDays: 1 }, "correct", now);
  assert.equal(upd.intervalDays, Math.round(1 * 2.5)); // 3 (rounded)
  assert.equal(upd.easeFactor, 2.6);
  assert.equal(upd.nextReviewAt.getTime(), now.getTime() + upd.intervalDays * DAY);
  assert.ok(upd.nextReviewAt.getTime() > now.getTime());
});

test("interval growth compounds across a streak of correct answers", () => {
  let state = { easeFactor: 2.5, intervalDays: 1 };
  const intervals: number[] = [];
  for (let i = 0; i < 4; i++) {
    const upd = nextSchedule(state, "correct", now);
    state = { easeFactor: upd.easeFactor, intervalDays: upd.intervalDays };
    intervals.push(upd.intervalDays);
  }
  // 1×2.5=2.5→3; 3×2.6=7.8→8; 8×2.7=21.6→22; 22×2.8=61.6→62 (ease capped at 2.8)
  assert.deepEqual(intervals, [3, 8, 22, 62]); // strict growth, SM-2 compounding
  assert.equal(state.easeFactor, EASE_CAP);
});

test("wrong answer resets interval to 1 and drops ease with a floor", () => {
  const upd = nextSchedule({ easeFactor: 2.5, intervalDays: 20 }, "wrong", now);
  assert.equal(upd.intervalDays, 1);
  assert.equal(upd.easeFactor, 2.3);
  assert.ok(upd.nextReviewAt.getTime() > now.getTime()); // never in the past
});

test("ease never drops below the 1.3 floor", () => {
  let state = { easeFactor: 1.4, intervalDays: 5 };
  for (let i = 0; i < 5; i++) {
    state = { easeFactor: nextSchedule(state, "wrong", now).easeFactor, intervalDays: 1 };
  }
  assert.equal(state.easeFactor, EASE_FLOOR);
});

test("ease never exceeds the 2.8 cap", () => {
  let state = { easeFactor: 2.75, intervalDays: 10 };
  state = { easeFactor: nextSchedule(state, "correct", now).easeFactor, intervalDays: 10 };
  assert.equal(state.easeFactor, EASE_CAP);
});

test("nextReviewAt is always strictly after now for both outcomes", () => {
  for (const outcome of ["correct", "wrong"] as const) {
    const upd = nextSchedule({ easeFactor: 2.5, intervalDays: 1 }, outcome, now);
    assert.ok(upd.nextReviewAt.getTime() > now.getTime(), `${outcome} must schedule the future`);
  }
});
