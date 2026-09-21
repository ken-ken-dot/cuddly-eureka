import assert from "node:assert/strict";
import { test } from "node:test";

import { DIRECTIONS, directionLanguages, directionLabel, directionSideLabel } from "../src/types";

/**
 * Multilingual brief Sections 3+5: the pair set widens additively while the
 * two V1 pairs keep byte-identical language codes and labels — the existing
 * TranslateScreen rendering must not change at all for rw/zh users.
 */

test("V1 pairs resolve to exactly the V1 language codes", () => {
  assert.deepEqual(directionLanguages("rw-zh"), { source: "rw", target: "zh-CN" });
  assert.deepEqual(directionLanguages("zh-rw"), { source: "zh-CN", target: "rw" });
});

test("new pairs resolve to proxy translation codes", () => {
  assert.deepEqual(directionLanguages("rw-en"), { source: "rw", target: "en" });
  assert.deepEqual(directionLanguages("en-de"), { source: "en", target: "de" });
  assert.deepEqual(directionLanguages("de-rw"), { source: "de", target: "rw" });
});

test("pair list has the V1 pairs first and no zero-sum duplicates", () => {
  assert.equal(DIRECTIONS[0], "rw-zh");
  assert.equal(DIRECTIONS[1], "zh-rw");
  assert.equal(new Set(DIRECTIONS).size, DIRECTIONS.length);
});

test("V1 labels are unchanged; new pairs render native names", () => {
  assert.equal(directionLabel("rw-zh"), "Kinyarwanda → 普通话");
  assert.equal(directionLabel("zh-rw"), "普通话 → Kinyarwanda");
  assert.equal(directionLabel("rw-en"), "Kinyarwanda → English");
  assert.equal(directionLabel("de-en"), "Deutsch → English");
});

test("side labels stay short for pills", () => {
  assert.equal(directionSideLabel("rw"), "KIN");
  assert.equal(directionSideLabel("zh"), "ZH");
  assert.equal(directionSideLabel("en"), "EN");
  assert.equal(directionSideLabel("de"), "DE");
});
