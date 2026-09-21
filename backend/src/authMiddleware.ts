import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

/**
 * Auth middleware (brief Section 4). With no database-level RLS, this app IS
 * the enforcement layer, so the invariant is absolute:
 *
 *   req.userId comes ONLY from a verified JWT. No route may ever read a
 *   userId from the body, query, or headers — data routes scope every query
 *   with `where user_id = req.userId` and nothing else.
 *
 * Usage:  router.get("/corrections", requireAuth, handler)
 *   (mount order matters — see auth routes: requireAuth BEFORE json parse
 *   helpers is fine; body is parsed by express.json globally in server.ts.)
 */
export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Sign in to continue." } });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub?: unknown };
    if (typeof payload.sub !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.sub)) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Session expired. Please log in again." } });
      return;
    }
    (req as AuthedRequest).userId = payload.sub;
    next();
  } catch {
    // Expired or forged access token — client refreshes via POST /api/auth/refresh.
    res.status(401).json({ error: { code: "TOKEN_EXPIRED", message: "Session expired. Please log in again." } });
  }
}

/** Narrowing helper for handlers: `const userId = mustAuth(req)`. */
export function mustAuth(req: Request): string {
  const userId = (req as AuthedRequest).userId;
  if (!userId) throw new Error("requireAuth must run before mustAuth");
  return userId;
}
