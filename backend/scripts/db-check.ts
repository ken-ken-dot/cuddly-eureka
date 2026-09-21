import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

/**
 * Step 1 of the build order: confirm the hosted Postgres works BEFORE any
 * endpoint or app work. Run with:
 *
 *   npm run db:check --workspace backend
 *
 * Exits 0 on success, 1 on failure. With --apply, also runs sql/schema.sql.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "[vuga-db] DATABASE_URL is not set.\n" +
      "  1. Provision a hosted Postgres (Neon is the default: https://neon.tech)\n" +
      "  2. Put the connection string in backend/.env as DATABASE_URL=...\n" +
      "  3. Re-run this script.",
  );
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  // Hosted providers (Neon/Railway/Render) terminate TLS themselves.
  ssl: /(^|[^:\w])localhost(:|$)/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
});

try {
  await client.connect();
  const { rows } = await client.query<{ now: string; version: string }>(
    "select now() as now, version() as version",
  );
  console.log(`[vuga-db] connected: ${rows[0]?.version.split(" ").slice(0, 2).join(" ")}`);
  console.log(`[vuga-db] server time: ${rows[0]?.now}`);

  if (process.argv.includes("--apply")) {
    const schema = fs.readFileSync(path.join(here, "..", "sql", "schema.sql"), "utf8");
    await client.query(schema);
    console.log("[vuga-db] schema applied (backend/sql/schema.sql)");
  } else {
    console.log("[vuga-db] (dry run — re-run with --apply to create the schema)");
  }
  console.log("[vuga-db] OK");
  process.exit(0);
} catch (err) {
  console.error("[vuga-db] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
