/**
 * Section 4's RLS-equivalent test — run with:
 *
 *   DATABASE_URL=... JWT_SECRET=... npm run test:auth --workspace backend
 *
 * Boots the REAL express app on an ephemeral port, creates two real accounts,
 * then tries to read/write user A's data while authenticated as user B.
 * Per the brief, this must pass BEFORE further build steps count as done.
 * Skips (exit 0, "SKIP") when DATABASE_URL/JWT_SECRET aren't set, so
 * `npm test` stays green in environments without a provisioned database.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { config } from "../src/config.js";
import { authRoutes } from "../src/authRoutes.js";
import { dataRoutes } from "../src/dataRoutes.js";
import { db, dbConfigured } from "../src/db.js";

if (!dbConfigured()) {
  console.log(
    "SKIP auth cross-access test — DATABASE_URL / JWT_SECRET not set.\n" +
      "  Re-run after provisioning (npm run db:schema) to execute it.",
  );
  process.exit(0);
}

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use(cors({ origin: config.corsOrigin }));
app.use("/api/auth", authRoutes);
app.use("/api", dataRoutes);

const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const emailA = `vuga-a-${crypto.randomUUID()}@test.local`;
const emailB = `vuga-b-${crypto.randomUUID()}@test.local`;

let tokensA: { accessToken: string; refreshToken: string };
let tokensB: { accessToken: string; refreshToken: string };

async function post(path: string, body: unknown, auth?: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function get(path: string, auth: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${auth}` } });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function put(path: string, body: unknown, auth: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

try {
  // --- Setup: two real accounts through the real endpoints -------------------
  const suA = await post("/api/auth/signup", { email: emailA, password: "correct horse battery" });
  assert.equal(suA.status, 200, `signup A: ${JSON.stringify(suA.json)}`);
  tokensA = suA.json;
  const suB = await post("/api/auth/signup", { email: emailB, password: "staple tambourine" });
  assert.equal(suB.status, 200, `signup B: ${JSON.stringify(suB.json)}`);
  tokensB = suB.json;
  assert.ok(tokensA.accessToken && tokensA.refreshToken);
  assert.ok(tokensB.accessToken && tokensB.refreshToken);

  // A seeds two corrections.
  const seed = await post(
    "/api/corrections",
    {
      corrections: [
        { localId: "cor_a1", wrong: "amafaranga angahe", right: "amafaranga angahe?", tip: "Question intonation", languagePair: "rw-zh", createdAt: 1_700_000_000_000 },
        { localId: "cor_a2", wrong: "nitwa Jean", right: "Nitwa Jean.", tip: "Capitalize names", languagePair: "rw-zh", createdAt: 1_700_000_001_000 },
      ],
    },
    tokensA.accessToken,
  );
  assert.equal(seed.status, 201, `seed A: ${JSON.stringify(seed.json)}`);
  // Fresh uploads default next_review_at = now() → immediately due (§8 gate:
  // "due pulls genuinely overdue items first" starts from this invariant).
  const seeded = await db().query<{ next_review_at: Date }>(
    "select next_review_at from corrections where user_id = (select id from users where email = $1)",
    [emailA],
  );
  assert.ok(seeded.rows.every((r) => new Date(r.next_review_at).getTime() <= Date.now()));

  // --- 1. Cross-access: B reads A's corrections -> must NOT see A's rows -----
  const crossRead = await get("/api/corrections", tokensB.accessToken);
  assert.equal(crossRead.status, 200);
  const bRows = crossRead.json.corrections as Array<{ wrong: string }>;
  assert.ok(
    !bRows.some((r) => r.wrong === "amafaranga angahe" || r.wrong === "nitwa Jean"),
    "SECURITY FAILURE: user B can read user A's corrections",
  );

  // --- 2. Cross-write: B cannot write into A's account ------------------------
  // Ids come from the verified JWT server-side; a client-supplied userId must
  // be ignored (and unknown columns rejected by parameterized queries).
  const crossWrite = await post(
    "/api/corrections",
    { userId: "00000000-0000-0000-0000-00000000000a", corrections: [{ localId: "cor_b_inject", wrong: "muraho", right: "Muraho!", tip: "Greeting", languagePair: "rw-zh" }] },
    tokensB.accessToken,
  );
  assert.equal(crossWrite.status, 201);
  const aRows = (await get("/api/corrections", tokensA.accessToken)).json.corrections as Array<{ wrong: string }>;
  assert.ok(
    !aRows.some((r) => r.wrong === "muraho"),
    "SECURITY FAILURE: user B wrote a row visible to user A",
  );

  // --- 3. Cross-write on settings: B's PUT must not touch A's settings -------
  const putA = await put("/api/settings", { theme: "light" }, tokensA.accessToken);
  assert.equal(putA.status, 200);
  const putB = await put("/api/settings", { theme: "dark", languagePair: "rw-zh" }, tokensB.accessToken);
  assert.equal(putB.status, 200);
  const settingsA = (await get("/api/settings", tokensA.accessToken)).json.settings;
  assert.equal(settingsA.theme, "light", "SECURITY FAILURE: B's settings write leaked into A");

  // --- 4. Auth required: no token / forged token rejected --------------------
  const noAuth = await fetch(`${base}/api/corrections`);
  assert.equal(noAuth.status, 401);
  const forged = jwt.sign({ sub: crypto.randomUUID() }, "not-the-real-secret");
  const forgedRes = await get("/api/corrections", forged);
  assert.equal(forgedRes.status, 401, "forged token must be rejected");

  // --- 5. Refresh rotation: old refresh token is single-use ------------------
  const r1 = await post("/api/auth/refresh", { refreshToken: tokensA.refreshToken });
  assert.equal(r1.status, 200, `refresh: ${JSON.stringify(r1.json)}`);
  assert.ok(r1.json.accessToken && r1.json.refreshToken);
  assert.notEqual(r1.json.refreshToken, tokensA.refreshToken, "refresh must rotate the token");
  const r2 = await post("/api/auth/refresh", { refreshToken: tokensA.refreshToken });
  assert.equal(r2.status, 401, "reused refresh token must be rejected");

  // --- 6. Logout revokes server-side -----------------------------------------
  const fresh = await post("/api/auth/login", { email: emailA, password: "correct horse battery" });
  assert.equal(fresh.status, 200);
  const rt = fresh.json.refreshToken as string;
  const lo = await post("/api/auth/logout", { refreshToken: rt });
  assert.equal(lo.status, 200);
  const afterLogout = await post("/api/auth/refresh", { refreshToken: rt });
  assert.equal(afterLogout.status, 401, "logged-out refresh token must no longer work");

  // --- 7. Duplicate signup rejected, login works ------------------------------
  const dup = await post("/api/auth/signup", { email: emailA, password: "whatever-99" });
  assert.equal(dup.status, 409);
  const relogin = await post("/api/auth/login", { email: emailA, password: "correct horse battery" });
  assert.equal(relogin.status, 200);

  // --- 8. Enumeration safety: unknown email vs wrong password are identical
  //        responses (same status + code + generic copy) -----------------------
  const unknownEmail = await post("/api/auth/login", { email: `ghost-${crypto.randomUUID()}@test.local`, password: "whatever-123" });
  const wrongPassword = await post("/api/auth/login", { email: emailA, password: "definitely-wrong" });
  assert.equal(unknownEmail.status, wrongPassword.status);
  assert.equal(unknownEmail.json?.error?.code, wrongPassword.json?.error?.code);
  assert.equal(unknownEmail.json?.error?.message, wrongPassword.json?.error?.message);
  assert.equal(unknownEmail.json?.error?.code, "INVALID_CREDENTIALS");
  assert.ok(!/no account|doesn't exist|not found/i.test(unknownEmail.json?.error?.message ?? ""));

  // --- 9. Token-type confusion: a valid ACCESS token must never be accepted
  //        as a refresh token (and vice versa) -------------------------------
  const accessAsRefresh = await post("/api/auth/refresh", { refreshToken: tokensA.accessToken });
  assert.equal(accessAsRefresh.status, 401, "access token must not work as refresh token");
  const refreshAsAccess = await get("/api/corrections", tokensA.refreshToken);
  assert.equal(refreshAsAccess.status, 401, "refresh token must not work as access token");

  // --- 10. Login rate limiting: 5 failed attempts → 429 -----------------------
  for (let i = 0; i < 5; i++) {
    const fail = await post("/api/auth/login", { email: emailB, password: "wrong-password-" + i });
    assert.equal(fail.status, 401);
  }
  const blocked = await post("/api/auth/login", { email: emailB, password: "staple tambourine" });
  assert.equal(blocked.status, 429, "6th attempt after 5 failures must be rate-limited");
  assert.equal(blocked.json?.error?.code, "TOO_MANY_ATTEMPTS");
  // Even the CORRECT password is blocked during the window (that's the point).
  // Cleanup unblocks B for future runs.

  // --- 11. Practice scoping (learning brief §8): B cannot review A's item.
  //        The due list is scoped, and reviewing a foreign correction id 404s
  //        without writing anything. ----------------------------------------
  const dueB = await get("/api/practice/due", tokensB.accessToken);
  assert.equal(dueB.status, 200);
  const dueBItems = dueB.json.items as Array<{ id: string; wrong: string }>;
  assert.ok(
    !dueBItems.some((i) => i.wrong === "amafaranga angahe" || i.wrong === "nitwa Jean"),
    "SECURITY FAILURE: user B sees user A's practice items",
  );
  // B grabs A's real correction id straight from the DB and tries to review it.
  const aRowsDb = await db().query<{ id: string }>(
    "select id from corrections where user_id = (select id from users where email = $1) limit 1",
    [emailA],
  );
  const aCorrectionId = aRowsDb.rows[0]?.id;
  assert.ok(aCorrectionId, "setup: A has a correction row");
  const foreignReview = await post(
    "/api/practice/review",
    { correctionId: aCorrectionId, wasCorrect: true },
    tokensB.accessToken,
  );
  assert.equal(foreignReview.status, 404, "reviewing another user's item must 404");
  const aReviewCount = await db().query<{ review_count: number }>(
    "select review_count from corrections where id = $1",
    [aCorrectionId],
  );
  assert.equal(aReviewCount.rows[0]?.review_count, 0, "no practice write may land on A's row");

  // --- 12. SM-2 write path against the live DB: A reviews their own item.
  //        Verify next_review_at actually moved into the future and review_count
  //        incremented — inspecting the row, not the UI (brief §8). --------
  const ownReview = await post(
    "/api/practice/review",
    { correctionId: aCorrectionId, wasCorrect: true },
    tokensA.accessToken,
  );
  assert.equal(ownReview.status, 200, `own review: ${JSON.stringify(ownReview.json)}`);
  const afterState = await db().query<{ next_review_at: Date; review_count: number; ease_factor: string }>(
    "select next_review_at, review_count, ease_factor from corrections where id = $1",
    [aCorrectionId],
  );
  const after = afterState.rows[0];
  assert.ok(after);
  assert.equal(after.review_count, 1);
  assert.equal(Number(after.ease_factor), 2.6, "ease nudges up 2.5 → 2.6 on correct");
  assert.ok(
    new Date(after.next_review_at).getTime() > Date.now(),
    "next_review_at must be scheduled in the future",
  );
  const sessionRows = await db().query<{ count: string }>(
    "select count(*)::int::text as count from practice_sessions where correction_id = $1",
    [aCorrectionId],
  );
  assert.equal(sessionRows.rows[0]?.count, "1", "one practice_sessions audit row");

  console.log("PASS  cross-access, rotation, revocation, hardening, practice (12/12 checks)");
  process.exitCode = 0;
} catch (err) {
  console.error("FAIL", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  // Cleanup test users + rate-limit rows (cascades to tokens/corrections/settings).
  try {
    await db().query("delete from users where email = any($1)", [[emailA, emailB]]);
    await db().query("delete from auth_rate_limits where key like 'login:%@test.local'");
  } catch {
    /* best effort */
  }
  server.close();
}
