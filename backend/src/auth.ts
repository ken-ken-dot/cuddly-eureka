import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

/**
 * Token + password primitives for the hand-rolled auth (brief Section 2,
 * hardened per the verification brief Section 0).
 *
 * We own hashing, issuance, refresh, and revocation — treated with the same
 * weight a managed auth vendor would apply:
 *
 *  - Access tokens: 15-min JWTs signed with JWT_SECRET, typ "access".
 *  - Refresh tokens: 7-day JWTs signed with the SEPARATE JWT_REFRESH_SECRET,
 *    typ "refresh" — plus their SHA-256 hash stored in Postgres for
 *    rotation + revocation, which a bare JWT can't do.
 *  - The two verifiers never cross: an access token can never verify as a
 *    refresh token or vice versa (different secrets AND explicit typ).
 */

// --- Passwords -------------------------------------------------------------

const BCRYPT_ROUNDS = 11;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// --- Access tokens (stateless, short-lived) --------------------------------

export interface AccessClaims {
  sub: string; // users.id (uuid)
  typ: "access";
  iat?: number;
  exp?: number;
}

const ACCESS_TTL_SECONDS = 15 * 60; // ~15 min per the brief

export function issueAccessToken(userId: string): string {
  return jwt.sign({ typ: "access" }, config.jwtSecret, {
    subject: userId,
    expiresIn: ACCESS_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessClaims | null {
  try {
    const claims = jwt.verify(token, config.jwtSecret) as AccessClaims;
    // typ guard: a token from another family must never be accepted here.
    if (claims.typ !== "access") return null;
    return claims;
  } catch {
    return null;
  }
}

// --- Refresh tokens (revocable, rotated on use) ----------------------------
//
// Raw refresh tokens are returned to the client exactly once and stored only
// as SHA-256 hashes — the same principle as password hashing (brief Section 3).
// Rotation on every refresh limits the blast radius of a leaked token, and
// `revoked` is what makes logout actually invalidate the session server-side.
//
// The JWT form exists so the token is self-describing (typ, sub, exp); the
// database row remains the authority on whether it is still usable.

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const REFRESH_BYTES = 32;

export interface RefreshClaims {
  jti: string; // refresh_tokens.id (uuid)
  sub: string; // users.id (uuid)
  typ: "refresh";
  iat?: number;
  exp?: number;
}

export function makeRefreshToken(userId: string, jti: string): { raw: string; hash: string; expiresAt: Date } {
  const nonce = crypto.randomBytes(REFRESH_BYTES).toString("base64url");
  const raw = `${jti}.${nonce}`;
  const claims: RefreshClaims = {
    jti,
    sub: userId,
    typ: "refresh",
  };
  const jwtToken = jwt.sign(claims, config.jwtRefreshSecret, {
    expiresIn: REFRESH_TTL_SECONDS,
  });
  // The client receives <jti>.<nonce>.<jwt>; only the full raw string hashes
  // to the stored digest, and only that full string is ever accepted back.
  const full = `${raw}.${jwtToken}`;
  return { raw: full, hash: refreshHash(full), expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000) };
}

export function refreshHash(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Fresh row id for refresh_tokens — supplied at insert so the JWT can bind to it. */
export function newRefreshJti(): string {
  return crypto.randomUUID();
}

/**
 * Verify a presented refresh token's JWT envelope with the REFRESH secret
 * and typ guard. Returns the jti/sub on success. This is defense-in-depth:
 * the database row (by token_hash) remains the authority on usability, but
 * an access token — or anything forged — is rejected before touching the DB.
 */
export function verifyRefreshToken(raw: string): { jti: string; sub: string } | null {
  const parts = raw.split(".");
  if (parts.length < 5) return null; // expected: jti.nonce.header.payload.sig
  const jwtPart = parts.slice(2).join(".");
  try {
    const claims = jwt.verify(jwtPart, config.jwtRefreshSecret) as RefreshClaims;
    if (claims.typ !== "refresh" || typeof claims.jti !== "string" || typeof claims.sub !== "string") {
      return null;
    }
    return { jti: claims.jti, sub: claims.sub };
  } catch {
    return null;
  }
}
