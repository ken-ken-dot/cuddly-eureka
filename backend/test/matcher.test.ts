import { test } from "node:test";
import assert from "node:assert/strict";
import { levenshtein, findCorrection } from "../src/matcher.js";

test("levenshtein handles basic distances", () => {
  assert.equal(levenshtein("amafaranga", "amaranga"), 2);
  assert.equal(levenshtein("amafaranga", "amafarang"), 1);
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("same", "same"), 0);
});

test("findCorrection matches a known mistake", () => {
  const hit = findCorrection("yabanje amaranga atanu");
  assert.ok(hit, "expected a match for 'amaranga'");
  assert.equal(hit.entry.right, "amafaranga");
  assert.equal(hit.matched, "amaranga");
});

test("findCorrection does NOT fire on the correct form", () => {
  assert.equal(findCorrection("yabanje amafaranga atanu"), null);
});

test("findCorrection returns null for unrelated input", () => {
  assert.equal(findCorrection("muraho neza"), null);
});
