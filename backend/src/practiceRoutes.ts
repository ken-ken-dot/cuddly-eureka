import { Router, type Request, type Response } from "express";
import { Type } from "@sinclair/typebox";
import { makeCompiler } from "./validation.js";
import { db, dbConfigured } from "./db.js";
import { requireAuth, mustAuth } from "./authMiddleware.js";
import { nextSchedule, initialSchedule } from "./sm2.js";

/**
 * Practice drill endpoints (learning brief Sections 3-5). Same authorization
 * rule as every other data route: req.userId comes from requireAuth's
 * verified JWT and scopes EVERY query; ownership is enforced inside the
 * query itself, so another user's correction is indistinguishable from a
 * missing one (404) and can never be read or written.
 */
export const practiceRoutes = Router();

const UUID_RE = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

const ReviewBody = Type.Object({
  correctionId: Type.String({ pattern: UUID_RE }),
  wasCorrect: Type.Boolean(),
});
const parseReview = makeCompiler<{ correctionId: string; wasCorrect: boolean }>(ReviewBody);

function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

function authNotConfigured(res: Response): void {
  sendError(
    res,
    503,
    "AUTH_NOT_CONFIGURED",
    "Practice isn't set up on this server yet. Add DATABASE_URL, JWT_SECRET, and JWT_REFRESH_SECRET to backend/.env.",
  );
}

// ---------------------------------------------------------------------------
// GET /api/practice/due (auth)
// -> items whose next_review_at has passed, most overdue first (brief §3).
//    Brand-new kept corrections default to next_review_at = now(), so they
//    enter the drill rotation immediately.
// ---------------------------------------------------------------------------

practiceRoutes.get("/due", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!dbConfigured()) return authNotConfigured(res);
    const userId = mustAuth(req);
    const rawLimit = Number((req.query.limit as string | undefined) ?? "15");
    const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, Math.floor(rawLimit))) : 15;

    const { rows } = await db().query<{
      id: string;
      wrong: string;
      right: string;
      tip: string;
      ease_factor: number | null;
      interval_days: number | null;
      next_review_at: Date;
      review_count: number | null;
    }>(
      `select id, wrong, "right", tip, ease_factor, interval_days, next_review_at, review_count
       from corrections
       where user_id = $1 and next_review_at <= now()
       order by next_review_at asc
       limit $2`,
      [userId, limit],
    );

    res.json({
      items: rows.map((r) => ({
        id: r.id,
        wrong: r.wrong,
        right: r.right,
        tip: r.tip,
        easeFactor: r.ease_factor ?? 2.5,
        intervalDays: r.interval_days ?? 1,
        nextReviewAt: new Date(r.next_review_at).toISOString(),
        reviewCount: r.review_count ?? 0,
      })),
    });
  } catch (err) {
    console.error("[vuga-practice] due failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "PRACTICE_FAILED", "Could not load your practice items. Try again later.");
  }
});

// ---------------------------------------------------------------------------
// POST /api/practice/review (auth) { correctionId, wasCorrect }
// -> SM-2 update on the correction + one practice_sessions audit row, in a
//    single transaction. The corrected/kept row must belong to req.userId.
// ---------------------------------------------------------------------------

practiceRoutes.post("/review", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!dbConfigured()) return authNotConfigured(res);
    const userId = mustAuth(req);
    const body = parseReview(req.body);

    // Ownership + current scheduling state in one scoped query. A correction
    // owned by someone else yields no row here — 404, never a write.
    const found = await db().query<{
      id: string;
      ease_factor: string | number | null;
      interval_days: number | null;
      review_count: number | null;
    }>(
      `select id, ease_factor, interval_days, review_count
       from corrections
       where id = $1 and user_id = $2
       limit 1`,
      [body.correctionId, userId],
    );
    const row = found.rows[0];
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "That practice item isn't in your list.");
    }

    const current = {
      easeFactor: row.ease_factor != null ? Number(row.ease_factor) : 2.5,
      intervalDays: row.interval_days ?? 1,
    };
    const validated = Number.isFinite(current.easeFactor) && current.easeFactor > 0
      ? current
      : initialSchedule();
    const update = nextSchedule(validated, body.wasCorrect ? "correct" : "wrong", new Date());

    const client = await db().connect();
    try {
      await client.query("begin");
      await client.query(
        `update corrections
         set ease_factor = $1, interval_days = $2, next_review_at = $3, review_count = review_count + 1
         where id = $4 and user_id = $5`,
        [update.easeFactor, update.intervalDays, update.nextReviewAt, body.correctionId, userId],
      );
      await client.query(
        `insert into practice_sessions (user_id, correction_id, was_correct) values ($1, $2, $3)`,
        [userId, body.correctionId, body.wasCorrect],
      );
      await client.query("commit");
    } catch (txErr) {
      await client.query("rollback");
      throw txErr;
    } finally {
      client.release();
    }

    res.status(200).json({
      easeFactor: update.easeFactor,
      intervalDays: update.intervalDays,
      nextReviewAt: update.nextReviewAt.toISOString(),
    });
  } catch (err) {
    console.error("[vuga-practice] review failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "PRACTICE_FAILED", "Could not save that answer. Try again — your progress is safe.");
  }
});
