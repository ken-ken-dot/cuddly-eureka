import "dotenv/config";
import fs from "node:fs";

export type ProviderName = "mock" | "google";

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 8787),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  provider: (process.env.VUGA_PROVIDER === "google" ? "google" : "mock") as ProviderName,
  mockLatencyMs: num(process.env.MOCK_LATENCY_MS, 150),

  // --- Auth + sync (brief Sections 2-5) -------------------------------------
  // DATABASE_URL + JWT_SECRET + JWT_REFRESH_SECRET come from backend/.env;
  // never hardcoded. validateEnv() (below) fails loudly at startup when the
  // auth config is broken or inconsistent.
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "",

  google: {
    // Multilingual brief Section 2: `GOOGLE_CLOUD_PROJECT` and
    // `GCP_PROJECT_ID` are aliases for the same value — either works.
    project:
      process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT_ID ?? "",
    location: process.env.GOOGLE_CLOUD_LOCATION || "global",
    /** Service-account JSON, either inline or via a mounted file (Cloud Run secret). */
    credentialsJson:
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
      (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE
        ? fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE, "utf8")
        : ""),
    /** Multilingual brief Section 2: a key FILE path — read at boot. Accepted
     *  in addition to the existing inline/file variants so the brief's exact
     *  two-variable setup works verbatim. */
    credentialsFile: process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8")
      : "",
  },
};

export function googleConfigured(): boolean {
  return Boolean(config.google.project && config.google.credentialsJson);
}

/** Credentials from any accepted source, inline JSON taking precedence. */
export function googleCredentialsJson(): string {
  return config.google.credentialsJson || config.google.credentialsFile;
}

/**
 * Loud, immediate env validation (hardening brief Section 0).
 *
 *  - Two JWT secrets that are equal, or only one of them set while auth is
 *    otherwise configured → FATAL at boot. A proxy in that state would sign
 *    tokens in a way we can't reason about — refusing to start is the
 *    honest behavior, not a mysterious first-request failure.
 *  - Fully unset auth (no DATABASE_URL, no secrets) → still allowed, so the
 *    proxy keeps booting for pure-mock dev (STT/MT work without a database);
 *    a prominent startup line says exactly what's off and /api/auth returns
 *    503 AUTH_NOT_CONFIGURED.
 */
function validateEnv(): void {
  const problems: string[] = [];
  if (config.jwtSecret && config.jwtRefreshSecret && config.jwtSecret === config.jwtRefreshSecret) {
    problems.push("JWT_SECRET and JWT_REFRESH_SECRET are the same value — they must be two genuinely different secrets (openssl rand -hex 32 for each). Sharing them lets one token type be mistaken for the other.");
  }
  if (!config.jwtSecret && config.jwtRefreshSecret) {
    problems.push("JWT_REFRESH_SECRET is set but JWT_SECRET is missing — set both.");
  }
  if (config.jwtSecret && !config.jwtRefreshSecret) {
    problems.push("JWT_SECRET is set but JWT_REFRESH_SECRET is missing — set both.");
  }
  if (config.databaseUrl && (!config.jwtSecret || !config.jwtRefreshSecret)) {
    problems.push("DATABASE_URL is set but one or both JWT secrets are missing — auth would half-configure and fail on first token issuance. Set JWT_SECRET and JWT_REFRESH_SECRET.");
  }

  if (problems.length > 0) {
    console.error("[vuga-proxy] FATAL — auth environment is misconfigured:");
    for (const p of problems) console.error(`[vuga-proxy]   - ${p}`);
    console.error("[vuga-proxy] Fix backend/.env and restart. Exiting.");
    process.exit(1);
  }

  if (!config.databaseUrl) {
    console.warn(
      "[vuga-proxy] auth disabled: DATABASE_URL / JWT_SECRET / JWT_REFRESH_SECRET are not set. " +
        "/api/auth* and /api/corrections|/api/settings will return 503 AUTH_NOT_CONFIGURED. " +
        "STT/MT/TTS are unaffected.",
    );
  }
}

validateEnv();
