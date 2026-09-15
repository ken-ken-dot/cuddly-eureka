import { test } from "node:test";
import assert from "node:assert/strict";

import { computeProficiency, levelLabel, type HistoryEntry } from "../src/corrections/proficiency";
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
    createdAt: seq,
    ...partial,
  };
}

function history(entries: Array<[at: number, hadMistake: boolean, entryId?: string, topic?: string]>): HistoryEntry[] {
  return entries.map(([at, hadMistake, entryId, topic]) => ({ at, hadMistake, entryId, topic }));
}

const TOPIC = "money";

test("topics with no kept mistakes and no exchanges are reported with no data", () => {
  const report = computeProficiency([], []);
  const money = report.topics.find((tp) => tp.topic === TOPIC);
  assert.ok(money);
  assert.equal(money.mistakes, 0);
  assert.equal(money.repeats, 0);
  assert.equal(money.clean, 0);
  // Aggregate ignores topics with no data.
  assert.equal(report.score, 0);
  assert.equal(report.level, 3);
});

test("one kept mistake gives a single-mistake topic the 'getting there' level", () => {
  const corrections = [record({ entryId: "money-amaranga", topic: TOPIC })];
  const report = computeProficiency(corrections, []);
  const money = report.topics.find((tp) => tp.topic === TOPIC)!;
  assert.equal(money.mistakes, 1);
  assert.equal(money.repeats, 0);
  assert.equal(money.level, 1);
});

test("keeping the same wrong form twice counts as a repeat", () => {
  const corrections = [
    record({ entryId: "money-amaranga", topic: TOPIC }),
    record({ entryId: "money-amaranga", topic: TOPIC }),
  ];
  const money = computeProficiency(corrections, []).topics.find((tp) => tp.topic === TOPIC)!;
  assert.equal(money.mistakes, 1); // distinct forms
  assert.equal(money.repeats, 1); // second keep of the same form
  assert.equal(money.level, 1); // one repeat is still "getting there"
});

test("keeping the same wrong form three times flips the topic to 'just starting'", () => {
  const corrections = [
    record({ entryId: "money-amaranga", topic: TOPIC }),
    record({ entryId: "money-amaranga", topic: TOPIC }),
    record({ entryId: "money-amaranga", topic: TOPIC }),
  ];
  const money = computeProficiency(corrections, []).topics.find((tp) => tp.topic === TOPIC)!;
  assert.equal(money.mistakes, 1);
  assert.equal(money.repeats, 2);
  assert.equal(money.level, 0);
});

test("three distinct mistakes flip the topic to 'just starting'", () => {
  const corrections = [
    record({ entryId: "greeting-murawo", topic: "greetings" }),
    record({ entryId: "thanks-murakoce", topic: "greetings" }),
    record({ entryId: "howare-amakulu", topic: "greetings" }),
  ];
  const greetings = computeProficiency(corrections, []).topics.find((tp) => tp.topic === "greetings")!;
  assert.equal(greetings.mistakes, 3);
  assert.equal(greetings.level, 0);
});

test("clean exchanges since the mistake lift the level: 1 mistake + 3 clean => 'nearly solid'", () => {
  const corrections = [record({ entryId: "money-amaranga", topic: TOPIC })];
  const events = history([
    [1, true, "money-amaranga"],
    [2, false],
    [3, false],
    [4, false],
  ]);
  const money = computeProficiency(corrections, events).topics.find((tp) => tp.topic === TOPIC)!;
  assert.equal(money.clean, 3);
  assert.equal(money.level, 2);
});

test("clean volume does not fully rescue a repeated mistake", () => {
  const corrections = [
    record({ entryId: "money-amaranga", topic: TOPIC, createdAt: 1 }),
    record({ entryId: "money-amaranga", topic: TOPIC, createdAt: 2 }),
    record({ entryId: "money-amaranga", topic: TOPIC, createdAt: 3 }),
  ];
  const events = history([
    [4, false],
    [5, false],
    [6, false],
  ]);
  const money = computeProficiency(corrections, events).topics.find((tp) => tp.topic === TOPIC)!;
  assert.equal(money.level, 0); // repeats dominate
});

test("a live mistake (not kept) still closes a clean streak", () => {
  const corrections = [record({ entryId: "money-amaranga" })];
  const events = history([
    [1, true, "money-amaranga"],
    [2, false],
    [3, false],
    [4, true, "greeting-murawo"], // live mistake in another topic, never kept
    [5, false],
    [6, false],
    [7, false],
  ]);
  const report = computeProficiency(corrections, events);
  const money = report.topics.find((tp) => tp.topic === TOPIC)!;
  // Streak attribution: 2 clean before the murawo mistake (money), then the
  // live greetings mistake redirects the next 3 clean to greetings.
  assert.equal(money.clean, 2);
  assert.equal(money.mistakes, 1);
  assert.equal(money.level, 1);
  const greetings = report.topics.find((tp) => tp.topic === "greetings")!;
  assert.equal(greetings.clean, 3);
  assert.equal(greetings.mistakes, 0);
  assert.equal(greetings.level, 3); // no kept mistake in greetings: nothing needs attention
});

test("the trailing open streak is capped so one quiet session can't max out", () => {
  const corrections = [record({ entryId: "money-amaranga" })];
  const events = [
    ...history([[1, true, "money-amaranga"]]),
    ...history([[1 + 0.5, false]]),
    ...Array.from({ length: 40 }, (_, i) => history([[i + 2, false]])),
  ];
  const money = computeProficiency(corrections, events).topics.find((tp) => tp.topic === TOPIC)!;
  assert.equal(money.clean, 10); // MAX_OPEN_STREAK
  assert.equal(money.level, 2); // one mistake + >=3 clean: 'nearly solid', not 'solid'
});

test("exchanges before the first mistake stay uncounted (honest zero baseline)", () => {
  const corrections: CorrectionRecord[] = [];
  const events = history([
    [1, false],
    [2, false],
  ]);
  const money = computeProficiency(corrections, events).topics.find((tp) => tp.topic === TOPIC)!;
  assert.equal(money.clean, 0);
  assert.equal(money.level, 3); // nothing needs attention; nothing measurable yet
});

test("levelLabel uses no CEFR-style assessment language", () => {
  for (const label of ["Just starting", "Getting there", "Nearly solid", "Solid"]) {
    assert.equal(typeof label, "string");
  }
  assert.equal(levelLabel(3), "Solid");
});

test("aggregate averages only practiced topics", () => {
  const corrections = [
    record({ entryId: "money-amaranga", topic: TOPIC }), // level 1
    record({ entryId: "greeting-murawo", topic: "greetings" }), // level 1
  ];
  const report = computeProficiency(corrections, []);
  assert.equal(report.topics.length > 0, true);
  assert.equal(report.level, 1); // avg(1,1) = 1
  assert.ok(report.score > 0 && report.score < 1);
});
