import { db } from "./db.js";

/**
 * Basic Postgres-backed failed-attempt limiter (hardening brief Section 2,
 * "repeated failed attempts"): brute-forcing /api/auth/login must not be
 * wide open. Deliberately simple — a fixed-window failed-attempt counter per
 * key (email), reset on success.
 *
 *   - 5 failed attempts per 15 minutes → 429 with retry guidance.
 *   - Successful login clears the counter for that email.
 *   - In-memory would not survive restarts/multi-instance; the DB is
 *     already there, so the counter lives there too.
 */

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;

export async function recordAuthFailure(key: string): Promise<void> {
  await db().query(
    `insert into auth_rate_limits (key, failed_count, window_start)
     values ($1, 1, now())
     on conflict (key) do update
       set failed_count = case
             when auth_rate_limits.window_start < now() - interval '${WINDOW_MINUTES} minutes'
               then 1
             else auth_rate_limits.failed_count + 1
           end,
           window_start = case
             when auth_rate_limits.window_start < now() - interval '${WINDOW_MINUTES} minutes'
               then now()
             else auth_rate_limits.window_start
           end`,
    [key],
  );
}

export async function clearAuthFailures(key: string): Promise<void> {
  await db().query("delete from auth_rate_limits where key = $1", [key]).catch(() => undefined);
}

/** Returns seconds until the client may retry, or null when not limited. */
export async function isAuthBlocked(key: string): Promise<number | null> {
  const { rows } = await db().query<{ failed_count: number; window_start: Date }>(
    "select failed_count, window_start from auth_rate_limits where key = $1",
    [key],
  );
  const row = rows[0];
  if (!row) return null;
  const windowMs = WINDOW_MINUTES * 60_000;
  const elapsed = Date.now() - new Date(row.window_start).getTime();
  if (elapsed >= windowMs) return null; // window expired — counter is stale
  if (row.failed_count < MAX_FAILURES) return null;
  return Math.ceil((windowMs - elapsed) / 1000);
}
