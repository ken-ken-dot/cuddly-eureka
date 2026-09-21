import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeWeakPoints,
  computeWeeklyTrend,
  trendLabel,
  recencyWeight,
} from "../src/practice/insights";
import type { CorrectionRecord } from "../src/store/corrections";

let seq = 0;
function record(partial: Partial<CorrectionRecord>): CorrectionRecord {
  seq += 1;
  return {
    id: `r${seq}`,
    wrong: "amaranga",
    right: "amafaranga",
    tip: "t",
    sourceLang: "rw",
    targetLang: "zh-CN",
    createdAt: Date.now() - 86_400_000,
    ...partial,
  };
}

const NOW = new Date("2026-09-18T12:00:00").getTime(); // a Friday
const DAY = 86_400_000;

test("recency weight decays: today ~1, two weeks ~0.5, a month ~0.2", () => {
  const now = NOW;
  assert.ok(recencyWeight(now, now) > 0.99);
  assert.ok(Math.abs(recencyWeight(now - 14 * DAY, now) - 0.5) < 0.01);
  assert.ok(recencyWeight(now - 30 * DAY, now) < 0.25);
  assert.equal(recencyWeight(now + DAY, now), 1); // future timestamps clamp to 1
});

test("topics rank by frequency weighted by recency, not raw counts", () => {
  const recent = computeWeakPoints(
    [
      record({ entryId: "money-amaranga", topic: "money", createdAt: NOW - DAY }),
      record({ entryId: "money-amaranga", topic: "money", createdAt: NOW - 2 * DAY }),
      record({ entryId: "money-amaranga", topic: "money", createdAt: NOW - 3 * DAY }),
    ],
    NOW,
  );
  const stale = computeWeakPoints(
    [
      record({ entryId: "greeting-murawo", topic: "greetings", createdAt: NOW - 60 * DAY }),
      record({ entryId: "greeting-murawo", topic: "greetings", createdAt: NOW - 60 * DAY }),
      record({ entryId: "greeting-murawo", topic: "greetings", createdAt: NOW - 60 * DAY }),
    ],
    NOW,
  );
  // Same frequency (1 distinct + 2 repeats) — but recent beats stale.
  assert.ok(recent[0]!.score > stale[0]!.score);
  // The brief's own example: yesterday's single mistake matters more than a
  // three-times-repeated mistake from ~two months ago that hasn't recurred.
  const mixed = computeWeakPoints(
    [
      ...[
        record({ entryId: "greeting-murawo", topic: "greetings", createdAt: NOW - 60 * DAY }),
        record({ entryId: "greeting-murawo", topic: "greetings", createdAt: NOW - 60 * DAY }),
        record({ entryId: "greeting-murawo", topic: "greetings", createdAt: NOW - 60 * DAY }),
      ],
      ...[
        record({ entryId: "money-amaranga", topic: "money", createdAt: NOW - DAY }),
      ],
    ],
    NOW,
  );
  assert.equal(mixed[0]!.topic, "money"); // recency dominates at 60 days stale
  assert.equal(mixed[1]!.topic, "greetings"); // stale items fade but stay visible
  assert.ok(mixed[1]!.score > 0); // faded, not erased — the history still happened
});

test("distinct forms count more than repeats of one form", () => {
  const points = computeWeakPoints(
    [
      record({ entryId: "money-amaranga", topic: "money", createdAt: NOW }),
      record({ entryId: "money-amaranga", topic: "money", createdAt: NOW }),
      record({ entryId: "howare-amakulu", topic: "money", createdAt: NOW }),
    ],
    NOW,
  );
  const money = points.find((p) => p.topic === "money")!;
  assert.equal(money.distinct, 2);
  assert.equal(money.total, 3);
});

test("non-curated corrections are honestly excluded", () => {
  const points = computeWeakPoints(
    [record({ wrong: "zzz-not-curated", right: "zzz", topic: "money" })],
    NOW,
  );
  assert.equal(points.length, 0);
});

test("empty history → empty ranking, no crash", () => {
  assert.deepEqual(computeWeakPoints([], NOW), []);
});

test("weekly trend buckets kept mistakes into Monday-start weeks", () => {
  // NOW is a Friday. This week started Monday NOW-4d.
  const points = computeWeeklyTrend(
    [
      record({ createdAt: NOW }), // this week
      record({ createdAt: NOW - 1 * DAY }), // this week (Thursday)
      record({ createdAt: NOW - 7 * DAY }), // last week
      record({ createdAt: NOW - 40 * DAY }), // beyond the window
    ],
    6,
    NOW,
  );
  assert.equal(points.length, 6);
  assert.equal(points[5]!.keptMistakes, 2); // current week
  assert.equal(points[4]!.keptMistakes, 1); // previous week
  assert.equal(points[0]!.keptMistakes, 0);
});

test("trend label stays honest with little or no data", () => {
  assert.equal(trendLabel([]), "Not enough data yet");
  assert.equal(trendLabel([{ weekStart: NOW, keptMistakes: 0 }, { weekStart: NOW + 7 * DAY, keptMistakes: 0 }]), "Not enough data yet");
  // Hand-built weeks (oldest→newest): last COMPLETE week is the second-to-last
  // point; the in-progress week is deliberately ignored by the label.
  const same = [
    { weekStart: 0, keptMistakes: 1 },
    { weekStart: 1, keptMistakes: 2 },
    { weekStart: 2, keptMistakes: 2 },
    { weekStart: 3, keptMistakes: 2 },
    { weekStart: 4, keptMistakes: 2 },
    { weekStart: 5, keptMistakes: 9 }, // current, partial — ignored
  ];
  assert.equal(trendLabel(same), "About the same as recent weeks");
  const fewer = [
    { weekStart: 0, keptMistakes: 4 },
    { weekStart: 1, keptMistakes: 2 },
    { weekStart: 2, keptMistakes: 2 },
    { weekStart: 3, keptMistakes: 2 },
    { weekStart: 4, keptMistakes: 1 },
    { weekStart: 5, keptMistakes: 0 },
  ];
  assert.equal(trendLabel(fewer), "Fewer mistakes than recent weeks");
});
