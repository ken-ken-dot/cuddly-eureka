import { Router, type Request, type Response } from "express";
import { Type } from "@sinclair/typebox";
import { makeCompiler } from "./validation.js";
import { db, dbConfigured } from "./db.js";
import { requireAuth, mustAuth } from "./authMiddleware.js";

/**
 * Account data endpoints (brief Sections 4-5). Every handler below follows
 * the ONE inviolable rule: the user id comes from requireAuth's verified JWT
 * (mustAuth(req)), never from any client-supplied field. Every query that
 * touches corrections or user_settings carries `user_id = $req.userId`.
 */
export const dataRoutes = Router();

const LANG_PAIR_RE = /^rw-zh$/;

// --- Payload schemas ---------------------------------------------------------

const CorrectionIn = Type.Object({
  wrong: Type.String({ minLength: 1, maxLength: 500 }),
  right: Type.String({ minLength: 1, maxLength: 500 }),
  tip: Type.String({ minLength: 1, maxLength: 1000 }),
  languagePair: Type.String({ pattern: "^[a-z]{2}-[a-z]{2,5}$" }),
  /** Client-local id + creation time survive the round trip so the app can
   *  reconcile the cloud copy with AsyncStorage without a second fetch. */
  localId: Type.Optional(Type.String({ maxLength: 100 })),
  createdAt: Type.Optional(Type.Number()),
});
export type CorrectionInput = {
  wrong: string;
  right: string;
  tip: string;
  languagePair: string;
  localId?: string;
  createdAt?: number;
};

const CorrectionsBody = Type.Object({
  corrections: Type.Array(CorrectionIn, { minItems: 1, maxItems: 500 }),
});

const SettingsBody = Type.Object({
  theme: Type.Optional(Type.Union([Type.Literal("dark"), Type.Literal("light"), Type.Literal("system")])),
  languagePair: Type.Optional(Type.String({ pattern: "^[a-z]{2}-[a-z]{2,5}$" })),
});

const parseCorrections = makeCompiler<{ corrections: CorrectionInput[] }>(CorrectionsBody);
const parseSettings = makeCompiler<{ theme?: string; languagePair?: string }>(SettingsBody);

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

function recordShape(c: CorrectionInput) {
  return {
    id: c.localId ?? null,
    wrong: c.wrong,
    right: c.right,
    tip: c.tip,
    languagePair: c.languagePair,
    createdAt: typeof c.createdAt === "number" ? c.createdAt : null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/corrections (auth) -> { corrections: [{ id, localId, wrong, right,
//                               tip, languagePair, createdAt }] } for req.userId
// ---------------------------------------------------------------------------

dataRoutes.get("/corrections", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!dbConfigured()) return authNotConfigured(res);
    const userId = mustAuth(req);
    const { rows } = await db().query<{
      id: string;
      local_id: string | null;
      wrong: string;
      right: string;
      tip: string;
      language_pair: string;
      created_at: Date;
    }>(
      "select id, local_id, wrong, \"right\", tip, language_pair, created_at\n" +
        "from corrections where user_id = $1 order by created_at desc limit 2000",
      [userId],
    );
    res.json({
      corrections: rows.map((r) => ({
        id: r.id,
        localId: r.local_id ?? undefined,
        wrong: r.wrong,
        right: r.right,
        tip: r.tip,
        languagePair: r.language_pair,
        createdAt: new Date(r.created_at).getTime(),
      })),
    });
  } catch (err) {
    console.error("[vuga-data] list corrections failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "SYNC_FAILED", "Could not load your saved corrections. Try again later.");
  }
});

// ---------------------------------------------------------------------------
// POST /api/corrections (auth) — bulk or single insert, scoped to req.userId.
// localId dedupes against rows this device already uploaded (idempotent sync).
// ---------------------------------------------------------------------------

dataRoutes.post("/corrections", requireAuth, async (req: Request, authedRes: Response) => {
  const res = authedRes;
  try {
    if (!dbConfigured()) return authNotConfigured(res);
    const userId = mustAuth(req);
    const body = parseCorrections(req.body);

    const inserted: Array<{ id: string; localId: string | null }> = [];
    const client = await db().connect();
    try {
      await client.query("begin");
      for (const c of body.corrections) {
        // The dedupe partial index makes (user_id, local_id) unique where
        // local_id is not null — the DB-level backstop for sync idempotency.
        const result = await client.query<{ id: string; local_id: string | null }>(
          "insert into corrections (user_id, local_id, wrong, \"right\", tip, language_pair, created_at)\n" +
            "values ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))\n" +
            "on conflict (user_id, local_id) where local_id is not null do update\n" +
            "  set wrong = excluded.wrong, \"right\" = excluded.\"right\", tip = excluded.tip,\n" +
            "      language_pair = excluded.language_pair, created_at = excluded.created_at\n" +
            "returning id, local_id",
          [userId, c.localId ?? null, c.wrong, c.right, c.tip, c.languagePair, c.createdAt ?? Date.now()],
        );
        const row = result.rows[0];
        if (row) inserted.push({ id: row.id, localId: row.local_id });
      }
      await client.query("commit");
    } catch (txErr) {
      await client.query("rollback");
      throw txErr;
    } finally {
      client.release();
    }

    res.status(201).json({ corrections: inserted.map((r) => ({ id: r.id, localId: r.localId ?? undefined })) });
  } catch (err) {
    console.error("[vuga-data] insert corrections failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "SYNC_FAILED", "Couldn't back up your history right now — nothing was lost locally. Try again later.");
  }
});

// ---------------------------------------------------------------------------
// GET /api/settings (auth) -> { settings: { theme, languagePair, updatedAt } }
// ---------------------------------------------------------------------------

dataRoutes.get("/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!dbConfigured()) return authNotConfigured(res);
    const userId = mustAuth(req);
    const { rows } = await db().query<{
      theme: string | null;
      language_pair: string | null;
      updated_at: Date;
    }>(
      "select theme, language_pair, updated_at from user_settings where user_id = $1",
      [userId],
    );
    const row = rows[0];
    res.json({
      settings: row
        ? {
            theme: row.theme ?? "dark",
            languagePair: row.language_pair ?? "rw-zh",
            updatedAt: new Date(row.updated_at).getTime(),
          }
        : null,
    });
  } catch (err) {
    console.error("[vuga-data] get settings failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "SYNC_FAILED", "Could not load your settings. Try again later.");
  }
});

// ---------------------------------------------------------------------------
// PUT /api/settings (auth) — upsert, scoped to req.userId.
// ---------------------------------------------------------------------------

dataRoutes.put("/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!dbConfigured()) return authNotConfigured(res);
    const userId = mustAuth(req);
    const body = parseSettings(req.body);

    const { rows } = await db().query<{ theme: string | null; language_pair: string | null; updated_at: Date }>(
      "insert into user_settings (user_id, theme, language_pair, updated_at)\n" +
        "values ($1, $2, $3, now())\n" +
        "on conflict (user_id) do update set\n" +
        "  theme = coalesce($2, user_settings.theme),\n" +
        "  language_pair = coalesce($3, user_settings.language_pair),\n" +
        "  updated_at = now()\n" +
        "returning theme, language_pair, updated_at",
      [userId, body.theme ?? null, body.languagePair ?? null],
    );
    const row = rows[0];
    res.json({
      settings: {
        theme: row?.theme ?? "dark",
        languagePair: row?.language_pair ?? "rw-zh",
        updatedAt: row ? new Date(row.updated_at).getTime() : Date.now(),
      },
    });
  } catch (err) {
    console.error("[vuga-data] put settings failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "SYNC_FAILED", "Could not save your settings. Try again later.");
  }
});
