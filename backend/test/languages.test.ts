import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LANGUAGES,
  KINYARWANDA,
  MANDARIN,
  ENGLISH,
  GERMAN,
  isSupportedLanguage,
  normalizeLanguageCode,
  sttRoutingFor,
  STT_LANGUAGE_ROUTING,
  V1_PAIR,
} from "../src/languages.js";

/**
 * Multilingual brief: the four verified languages, with the original pair
 * untouched and first. The region table is the single source of truth for
 * STT routing (Section 3) — these tests pin it so a language can't silently
 * stream through the wrong endpoint.
 */

test("catalog contains exactly the four verified languages, V1 pair first", () => {
  assert.deepEqual(LANGUAGES.map((l) => l.code), ["rw", "zh-CN", "en", "de"]);
  assert.equal(V1_PAIR.source, KINYARWANDA);
  assert.equal(V1_PAIR.target, MANDARIN);
});

test("kinyarwanda routes through eu with the short model and no adaptation", () => {
  const r = sttRoutingFor("rw");
  assert.ok(r);
  assert.equal(r.region, "eu");
  assert.equal(r.sttCode, "rw-RW");
  assert.equal(r.model, "short");
  assert.equal(r.adaptation, false);
});

test("en/de/zh route through global with chirp_3 and verified STT codes", () => {
  assert.deepEqual(
    [...STT_LANGUAGE_ROUTING.entries()].map(([code, r]) => [code, r.region, r.sttCode, r.model]),
    [
      ["rw", "eu", "rw-RW", "short"],
      ["zh-CN", "global", "cmn-Hans-CN", "chirp_3"],
      ["en", "global", "en-US", "chirp_3"],
      ["de", "global", "de-DE", "chirp_3"],
    ],
  );
});

test("normalization still accepts the V1 codes plus en/de, and nothing else", () => {
  assert.equal(normalizeLanguageCode("rw"), "rw");
  assert.equal(normalizeLanguageCode("zh"), "zh-CN");
  assert.equal(normalizeLanguageCode("zh-CN"), "zh-CN");
  assert.equal(normalizeLanguageCode("en"), "en");
  assert.equal(normalizeLanguageCode("de"), "de");
  assert.equal(normalizeLanguageCode("fr"), null);
  assert.equal(normalizeLanguageCode("es"), null);
  assert.equal(normalizeLanguageCode(42), null);
  assert.equal(isSupportedLanguage("en"), true);
  assert.equal(isSupportedLanguage("xx"), false);
});
