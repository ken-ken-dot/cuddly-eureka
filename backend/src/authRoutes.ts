import { Router, type Request, type Response } from "express";
import { Type } from "@sinclair/typebox";
import { makeCompiler } from "./validation.js";
import { db, dbConfigured } from "./db.js";
import {
  hashPassword,
  verifyPassword,
  issueAccessToken,
  makeRefreshToken,
  refreshHash,
  newRefreshJti,
  verifyRefreshToken,
} from "./auth.js";
import { isAuthBlocked, recordAuthFailure, clearAuthFailures } from "./rateLimit.js";

/**
 * Hand-rolled auth endpoints (brief Sections 2, 5). Mounted at /api/auth.
 * All of these are intentionally independent of the STT/MT proxy routes —
 * additive only; nothing existing changes.
 */
export const authRoutes = Router();

const SignupBody = Type.Object({
  email: Type.String({ minLength: 3, maxLength: 254 }),
  password: Type.String({ minLength: 8, maxLength: 128 }),
});
const LoginBody = Type.Object({
  email: Type.String({ minLength: 3, maxLength: 254 }),
  password: Type.String({ minLength: 1, maxLength: 128 }),
});
// Raw refresh tokens are <uuid jti>.<43-char nonce>.<jwt> — allow up to 512.
const RefreshBody = Type.Object({ refreshToken: Type.String({ minLength: 16, maxLength: 512 }) });
const LogoutBody = Type.Object({ refreshToken: Type.String({ minLength: 16, maxLength: 512 }) });

const parseSignup = makeCompiler<{ email: string; password: string }>(SignupBody);
const parseLogin = makeCompiler<{ email: string; password: string }>(LoginBody);
const parseRefresh = makeCompiler<{ refreshToken: string }>(RefreshBody);
const parseLogout = makeCompiler<{ refreshToken: string }>(LogoutBody);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invalid bcrypt digest used to equalize timing for unknown emails. The
 *  .catch guards against any bcryptjs version that rejects malformed hashes. */
const DUMMY_HASH = "$2a$11$0000000000000000000000000000000000000000000000000000";

/** Normalize emails so `A@x.com` and `a@x.com` are the same account. */
function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Uniform error shape — matches the proxy's existing `{ error: { code, message } }`. */
function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

function authNotConfigured(res: Response): void {
  sendError(
    res,
    503,
    "AUTH_NOT_CONFIGURED",
    "Accounts aren't set up on this server yet. Add DATABASE_URL and JWT_SECRET to backend/.env.",
  );
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

/** Issue an access + refresh pair and persist the refresh hash (rotated family). */
async function issueSession(res: Response, userId: string): Promise<void> {
  const accessToken = issueAccessToken(userId);
  const jti = newRefreshJti();
  const refresh = makeRefreshToken(userId, jti);
  // The row id IS the JWT's jti — token, database row, and revocation all bind.
  await db().query(
    "insert into refresh_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)",
    [jti, userId, refresh.hash, refresh.expiresAt],
  );
  res.status(200).json({ accessToken, refreshToken: refresh.raw });
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup  { email, password } -> { accessToken, refreshToken }
// ---------------------------------------------------------------------------

authRoutes.post("/signup", async (req: Request, res: Response) => {
  try {
    if (!dbConfigured()) return authNotConfigured(res);
    const body = parseSignup(req.body);
    const email = normalizeEmail(body.email);
    if (!EMAIL_RE.test(email)) {
      return sendError(res, 400, "INVALID_EMAIL", "Enter a valid email address.");
    }
    if (body.password.length < 8) {
      return sendError(res, 400, "WEAK_PASSWORD", "Password must be at least 8 characters.");
    }

    const existing = await db().query<{ id: string }>(
      "select id from users where email = $1 limit 1",
      [email],
    );
    if (existing.rows.length > 0) {
      return sendError(res, 409, "EMAIL_EXISTS", "An account with this email already exists. Log in instead.");
    }

    const passwordHash = await hashPassword(body.password);
    const inserted = await db().query<UserRow>(
      "insert into users (email, password_hash) values ($1, $2) returning id, email, password_hash",
      [email, passwordHash],
    );
    const user = inserted.rows[0];
    if (!user) return sendError(res, 500, "SIGNUP_FAILED", "Could not create the account. Please try again.");

    // Every new account gets a settings row (brief Section 3 defaults).
    await db().query(
      "insert into user_settings (user_id) values ($1) on conflict (user_id) do nothing",
      [user.id],
    );

    await issueSession(res, user.id);
  } catch (err) {
    console.error("[vuga-auth] signup failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "SIGNUP_FAILED", "Could not create the account. Please try again.");
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login  { email, password } -> { accessToken, refreshToken }
// ---------------------------------------------------------------------------

authRoutes.post("/login", async (req: Request, res: Response) => {
  try {
    if (!dbConfigured()) return authNotConfigured(res);
    const body = parseLogin(req.body);
    const email = normalizeEmail(body.email);

    const found = await db().query<UserRow>(
      "select id, email, password_hash from users where email = $1 limit 1",
      [email],
    );
    const user = found.rows[0];

    // Basic brute-force throttle per email (hardening brief Section 2).
    const retryAfter = await isAuthBlocked(`login:${email}`);
    if (retryAfter !== null) {
      return sendError(
        res,
        429,
        "TOO_MANY_ATTEMPTS",
        `Too many attempts. Please wait ${Math.max(1, Math.ceil(retryAfter / 60))} minute(s) and try again.`,
      );
    }

    // Same message + timing profile for unknown email and wrong password, so
    // the endpoint can't be used to discover which emails have accounts.
    const badRequest = () => sendError(res, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    if (!user) {
      await verifyPassword(body.password, DUMMY_HASH).catch(() => false);
      await recordAuthFailure(`login:${email}`);
      return badRequest();
    }
    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) {
      await recordAuthFailure(`login:${email}`);
      return badRequest();
    }
    await clearAuthFailures(`login:${email}`);

    await issueSession(res, user.id);
  } catch (err) {
    console.error("[vuga-auth] login failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "LOGIN_FAILED", "Could not sign in. Please try again.");
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh  { refreshToken } -> { accessToken, refreshToken }
//
// Rotating: the presented refresh token is revoked and a NEW one issued.
// If a revoked token is ever presented again, the whole token family is
// revoked — the standard signal that a token was stolen and replayed.
// ---------------------------------------------------------------------------

interface RefreshRow {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked: boolean;
}

authRoutes.post("/refresh", async (req: Request, res: Response) => {
  try {
    if (!dbConfigured()) return authNotConfigured(res);
    const body = parseRefresh(req.body);
    // Envelope check first: wrong-secret/wrong-typ/malformed tokens are
    // rejected before any database lookup (token-type confusion defense).
    if (!verifyRefreshToken(body.refreshToken)) {
      return sendError(res, 401, "INVALID_REFRESH", "Session expired. Please log in again.");
    }
    const hash = refreshHash(body.refreshToken);

    const found = await db().query<RefreshRow>(
      "select id, user_id, expires_at, revoked from refresh_tokens where token_hash = $1 limit 1",
      [hash],
    );
    const row = found.rows[0];
    if (!row) {
      return sendError(res, 401, "INVALID_REFRESH", "Session expired. Please log in again.");
    }

    if (row.revoked) {
      // Replay of a rotated token — treat the family as compromised.
      await db().query("update refresh_tokens set revoked = true where user_id = $1", [row.user_id]);
      return sendError(res, 401, "REFRESH_REUSED", "Session expired. Please log in again.");
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return sendError(res, 401, "REFRESH_EXPIRED", "Session expired. Please log in again.");
    }

    const rotated = await db().query(
      "update refresh_tokens set revoked = true where id = $1 and revoked = false",
      [row.id],
    );
    if ((rotated.rowCount ?? 0) === 0) {
      // Lost a concurrent rotation race — same replay handling as above.
      await db().query("update refresh_tokens set revoked = true where user_id = $1", [row.user_id]);
      return sendError(res, 401, "REFRESH_REUSED", "Session expired. Please log in again.");
    }

    await issueSession(res, row.user_id);
  } catch (err) {
    console.error("[vuga-auth] refresh failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "REFRESH_FAILED", "Could not refresh the session. Please log in again.");
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout  { refreshToken } -> revokes that refresh token
// Idempotent: unknown/already-revoked tokens still return 200 so the client
// can always clear local state.
// ---------------------------------------------------------------------------

authRoutes.post("/logout", async (req: Request, res: Response) => {
  try {
    if (!dbConfigured()) return authNotConfigured(res);
    const body = parseLogout(req.body);
    // Idempotent: malformed or unknown tokens still return 200 so the client
    // can always clear local state.
    if (verifyRefreshToken(body.refreshToken)) {
      await db().query("update refresh_tokens set revoked = true where token_hash = $1", [
        refreshHash(body.refreshToken),
      ]);
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[vuga-auth] logout failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "LOGOUT_FAILED", "Could not sign out on the server. Please try again.");
  }
});
