import { Pool } from "pg";
import { config } from "./config.js";

/**
 * Shared Postgres pool for the auth + sync tables. Lazy: constructed on first
 * use so the proxy keeps starting (and mock STT/MT keeps working) with no
 * DATABASE_URL configured. Endpoint handlers return 503 AUTH_NOT_CONFIGURED
 * in that case, mirroring how googleConfigured() gates the provider routes.
 */
let pool: Pool | null = null;

export function db(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      // Hosted providers (Neon/Railway/Render) terminate TLS themselves.
      ssl: /(^|[^:\w])localhost(:|$)/.test(config.databaseUrl)
        ? undefined
        : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export function dbConfigured(): boolean {
  return Boolean(config.databaseUrl && config.jwtSecret && config.jwtRefreshSecret);
}
