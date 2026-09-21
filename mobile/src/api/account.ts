import * as SecureStore from "expo-secure-store";

import { useSettings } from "../store/settings";
import { ApiError } from "./errors";

/**
 * Account client for the hand-rolled auth API on the VUGA proxy (brief
 * Sections 2, 5). Mirrors src/api/client.ts conventions: same error shape,
 * same timeout discipline, same "the app works without this" philosophy.
 *
 * Tokens live in expo-secure-store (OS keychain/keystore) — deliberately NOT
 * AsyncStorage, which is plain local app data and where tokens don't belong.
 * Every account call is best-effort: failures throw typed ApiErrors the UI
 * can present, and never block the signed-out core flows.
 */

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const TIMEOUT_MS = 25_000;

const ACCESS_KEY = "vuga.auth.accessToken";
const REFRESH_KEY = "vuga.auth.refreshToken";
const USER_KEY = "vuga.auth.user";

// --- Secure token storage ---------------------------------------------------

export async function saveTokens(tokens: AuthTokens, user: AuthUser): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
  setTokenPresence(true);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
  setTokenPresence(false);
}

export async function loadStoredUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    const accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
    if (!raw || !accessToken) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (typeof parsed?.id !== "string" || typeof parsed?.email !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** True while tokens exist in secure storage — the sync engine's guard. */
export function isSignedIn(): boolean {
  // Synchronous probe of the access token's existence. SecureStore reads are
  // async; this uses a best-effort cached flag updated by save/clear.
  return tokenPresence;
}

/** Module-level presence flag, updated by saveTokens/clearTokens. */
let tokenPresence = false;

/** Refresh the presence flag from storage (call once at boot, after restore). */
export async function refreshPresenceFlag(): Promise<void> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_KEY).catch(() => null);
  tokenPresence = Boolean(accessToken);
}

/** Internal setter used by saveTokens/clearTokens to keep the flag honest. */
function setTokenPresence(present: boolean): void {
  tokenPresence = present;
}

async function readAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

// --- Low-level request helper ------------------------------------------------

interface ApiErrorShape {
  error?: { code?: string; message?: string };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const base = useSettings.getState().proxyUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, { ...init, signal: controller.signal });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const err = (parsed as ApiErrorShape | null)?.error;
      throw new ApiError(
        err?.code ?? "REQUEST_FAILED",
        err?.message ?? "The account service reported a problem. Please try again.",
        res.status,
      );
    }
    return parsed as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError("TIMEOUT", "The request took too long. Check your connection and try again.", 0);
    }
    throw new ApiError(
      "NETWORK",
      "Can't reach the account service. Check your internet connection (and that the VUGA proxy is running).",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}

function jsonInit(method: string, body: unknown, accessToken?: string): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    // GET/HEAD requests can't carry a body (fetch throws).
    ...(method === "GET" || method === "HEAD" ? {} : { body: JSON.stringify(body) }),
  };
}

// --- Auth endpoints (brief Section 5) ---------------------------------------

function tokensFrom(payload: unknown): { tokens: AuthTokens; user: AuthUser } {
  const p = payload as { accessToken?: unknown; refreshToken?: unknown };
  if (typeof p?.accessToken !== "string" || typeof p?.refreshToken !== "string") {
    throw new ApiError("SERVER", "The server response was missing session tokens.", 500);
  }
  const tokens = { accessToken: p.accessToken, refreshToken: p.refreshToken };
  // The JWT subject is the user id; decode without verifying (it came over
  // TLS from our own proxy alongside the tokens — verification is the
  // server's job on every authenticated request).
  const user = userFromToken(tokens.accessToken);
  return { tokens, user };
}

function userFromToken(accessToken: string): AuthUser {
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1] ?? "")) as { sub?: string };
    return { id: payload.sub ?? "", email: "" };
  } catch {
    return { id: "", email: "" };
  }
}

export async function signup(email: string, password: string): Promise<AuthUser> {
  const payload = await request<unknown>("/api/auth/signup", jsonInit("POST", { email, password }));
  const { tokens, user } = tokensFrom(payload);
  await saveTokens(tokens, { ...user, email });
  return { ...user, email };
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const payload = await request<unknown>("/api/auth/login", jsonInit("POST", { email, password }));
  const { tokens, user } = tokensFrom(payload);
  // The login response carries no email; keep the one the user typed.
  await saveTokens(tokens, { ...user, email });
  return { ...user, email };
}

/** Rotate tokens; persists the NEW pair. Throws TOKEN_EXPIRED family on failure. */
export async function refreshTokens(): Promise<AuthUser | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const payload = await request<unknown>("/api/auth/refresh", jsonInit("POST", { refreshToken }));
    const { tokens, user } = tokensFrom(payload);
    const previous = await loadStoredUser();
    const merged = { ...user, email: previous?.email ?? user.email };
    await saveTokens(tokens, merged);
    return merged;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // Refresh token rejected (expired/revoked/reused) — session is over.
      await clearTokens();
      throw new ApiError("SESSION_EXPIRED", "Your session expired. Please log in again.", 401);
    }
    throw e;
  }
}

/** Revoke the refresh token server-side. Idempotent; clears local state too. */
export async function logoutRemote(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  try {
    if (refreshToken) {
      await request<unknown>("/api/auth/logout", jsonInit("POST", { refreshToken }));
    }
  } finally {
    await clearTokens();
  }
}

// --- Authenticated data calls with one silent retry on expired access token --

async function authedRequest<T>(path: string, init: RequestInit): Promise<T> {
  const accessToken = await readAccessToken();
  if (!accessToken) throw new ApiError("SIGNED_OUT", "You're signed out.", 401);
  try {
    return await request<T>(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } });
  } catch (e) {
    if (e instanceof ApiError && (e.code === "TOKEN_EXPIRED" || e.status === 401)) {
      const user = await refreshTokens();
      if (!user) throw e;
      const fresh = await readAccessToken();
      if (!fresh) throw e;
      return request<T>(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${fresh}` } });
    }
    throw e;
  }
}

// --- Corrections sync (brief Sections 6-7) ----------------------------------

export interface CorrectionUpload {
  localId: string;
  wrong: string;
  right: string;
  tip: string;
  languagePair: string;
  createdAt: number;
}

export interface CorrectionDownload {
  id: string;
  localId?: string;
  wrong: string;
  right: string;
  tip: string;
  languagePair: string;
  createdAt: number;
  /** Reserved for proficiency sync; absent in V1 responses. */
  topic?: string;
}

export async function pushCorrections(items: CorrectionUpload[]): Promise<void> {
  if (items.length === 0) return;
  await authedRequest("/api/corrections", jsonInit("POST", { corrections: items }));
}

export async function fetchCorrections(): Promise<CorrectionDownload[]> {
  const payload = await authedRequest<{ corrections: CorrectionDownload[] }>(
    "/api/corrections",
    jsonInit("GET", {}),
  );
  return payload.corrections ?? [];
}

// --- Settings sync ------------------------------------------------------------

export interface CloudSettings {
  theme: "dark" | "light" | "system";
  languagePair: string;
  updatedAt: number;
}

export async function fetchSettings(): Promise<CloudSettings | null> {
  const payload = await authedRequest<{ settings: CloudSettings | null }>("/api/settings", jsonInit("GET", {}));
  return payload.settings;
}

export async function pushSettings(theme: string, languagePair: string): Promise<void> {
  await authedRequest("/api/settings", jsonInit("PUT", { theme, languagePair }));
}

// --- Practice drills (learning brief Sections 3-6) ---------------------------
// Signed-in feature: spaced-repetition state lives server-side so
// next_review_at persists correctly across devices.

export interface DrillItem {
  id: string;
  wrong: string;
  right: string;
  tip: string;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: string;
  reviewCount: number;
}

/** Items whose next_review_at has passed — most overdue first (server-ordered). */
export async function fetchDueItems(limit = 12): Promise<DrillItem[]> {
  const payload = await authedRequest<{ items: DrillItem[] }>(
    `/api/practice/due?limit=${limit}`,
    jsonInit("GET", {}),
  );
  return payload.items ?? [];
}

/** Submit one drill answer; server applies the SM-2 update + audit row. */
export async function submitReview(correctionId: string, wasCorrect: boolean): Promise<void> {
  await authedRequest("/api/practice/review", jsonInit("POST", { correctionId, wasCorrect }));
}
