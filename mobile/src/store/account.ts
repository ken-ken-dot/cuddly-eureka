import { create } from "zustand";

import * as accountApi from "../api/account";
import { classifyAuthError, isApiError } from "../api/errors";
import { useCorrections } from "./corrections";
import { useSettings } from "./settings";
import { setSyncListener, runSyncNow, loadLastSyncedAt, markCloudSettingsApplied } from "./sync";
import type { SyncOutcome } from "./sync";

/**
 * Account state (brief Sections 6-7). Deliberately shaped around one idea:
 * the app is fully usable signed out, and signing in ADDS cloud backup +
 * cross-device sync. Local AsyncStorage data is never deleted or gated.
 *
 * Signup explicitly reads as "back this up and take it with you":
 *  1. upload existing local corrections as a bulk insert (loud-safe — on
 *     failure the user is told nothing was lost, and the local copy is kept)
 *  2. the sync engine merges anything already in the cloud (e.g. corrections
 *     from another device when logging in on a new phone)
 *  3. settings sync runs once via the engine (cloud pulled down on first
 *     sign-in per device, then local wins and is pushed up)
 *
 * All sync work itself lives in store/sync.ts; this store holds auth state
 * and the loud-safe signup migration UX.
 */
export type AccountErrorKind =
  | "EMAIL_EXISTS"
  | "INVALID_CREDENTIALS"
  | "INVALID_EMAIL"
  | "WEAK_PASSWORD"
  | "NETWORK"
  | "TIMEOUT"
  | "SERVER"
  | "AUTH_NOT_CONFIGURED"
  | "SESSION_EXPIRED"
  | "MIGRATION_FAILED"
  | "UNKNOWN";

export interface AccountError {
  kind: AccountErrorKind;
  message: string;
}

export type MigrationStatus = "idle" | "uploading" | "done" | "failed";

interface AccountState {
  /** The signed-in user, or null when signed out. */
  user: accountApi.AuthUser | null;
  /** True while the stored session is being restored on app launch. */
  restoring: boolean;
  /** True while a signup/login/logout call is in flight. */
  loading: boolean;
  /** The most recent auth error (shown inline on the auth screens). */
  error: AccountError | null;
  /** Signup/login's local-history backup step, for Profile's status line. */
  migration: MigrationStatus;
  /** ISO timestamp of the last successful cloud backup, or null. */
  lastSyncedAt: string | null;
  /** Which opt-in auth sheet Profile requested, or null when closed. */
  authSheet: "signup" | "login" | null;

  /** Restore a stored session (silent, best-effort) at app boot. */
  restore: () => Promise<void>;
  /** Create an account; backs up existing local history loud-safe. */
  signup: (email: string, password: string) => Promise<boolean>;
  /** Log in; merges cloud history down and pushes local history up. */
  login: (email: string, password: string) => Promise<boolean>;
  /** Log out; revokes the session server-side, keeps ALL local data. */
  logout: () => Promise<void>;
  /** Dismiss the inline auth error. */
  clearError: () => void;
  /** Profile asks for the signup/login sheet; App hosts the modal. */
  openAuthSheet: (view: "signup" | "login") => void;
  /** Close the opt-in auth sheet (also fired by the screens' "Not now"). */
  closeAuthSheet: () => void;
}

function toUpload(r: { id: string; wrong: string; right: string; tip: string; createdAt: number }) {
  return {
    localId: r.id,
    wrong: r.wrong,
    right: r.right,
    tip: r.tip,
    languagePair: "rw-zh", // V1's only pair
    createdAt: r.createdAt,
  };
}

export const useAccount = create<AccountState>((set) => ({
  user: null,
  restoring: true,
  loading: false,
  error: null,
  migration: "idle",
  lastSyncedAt: null,
  authSheet: null,

  openAuthSheet: (view) => set({ authSheet: view, error: null }),

  closeAuthSheet: () => set({ authSheet: null }),

  restore: async () => {
    try {
      // Refresh the token-presence flag before any signed-in probe runs.
      await accountApi.refreshPresenceFlag();
      const user = await accountApi.loadStoredUser();
      if (user) {
        set({ user });
        setSyncListener(onSyncOutcome);
        void runSyncNow();
      }
    } catch {
      // No restorable session — stay signed out silently.
    } finally {
      set({ restoring: false, lastSyncedAt: await loadLastSyncedAt() });
    }
  },

  signup: async (email, password) => {
    set({ loading: true, error: null, migration: "idle" });
    try {
      // 1. Snapshot local history BEFORE creating the account (brief Section 6).
      const local = useCorrections.getState().corrections;
      const user = await accountApi.signup(email.trim().toLowerCase(), password);
      set({ user, loading: false });
      setSyncListener(onSyncOutcome);

      // 2. Loud-safe migration (Section 6.4): push existing corrections up.
      //    On failure the user keeps everything locally and is told clearly.
      if (local.length > 0) {
        set({ migration: "uploading" });
        try {
          await accountApi.pushCorrections(local.map(toUpload));
          set({ migration: "done" });
        } catch {
          set({
            migration: "failed",
            error: {
              kind: "MIGRATION_FAILED",
              message:
                "Your account is ready, but we couldn't back up your history right now. You're still signed in and nothing local was lost — we'll retry automatically.",
            },
          });
        }
      } else {
        set({ migration: "done" });
      }

      // 3. A brand-new account has no cloud state to pull: mark settings as
      //    applied so the sync pass pushes local settings up without first
      //    adopting the server's defaults over this device's choices.
      await markCloudSettingsApplied();

      // 4. Ongoing sync pass (pull cloud just in case, settings up, mark time).
      await handleSyncResult(await runSyncNow());
      return true;
    } catch (e) {
      set({ loading: false, error: toAccountError(e) });
      return false;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null, migration: "idle" });
    try {
      const local = useCorrections.getState().corrections;
      const user = await accountApi.login(email.trim().toLowerCase(), password);
      set({ user, loading: false });
      setSyncListener(onSyncOutcome);

      // Push local history up (idempotent — deduped by localId server-side).
      if (local.length > 0) {
        set({ migration: "uploading" });
        try {
          await accountApi.pushCorrections(local.map(toUpload));
          set({ migration: "done" });
        } catch {
          set({ migration: "failed" });
        }
      }

      // Pull this account's cloud state down (merges other devices' rows).
      await handleSyncResult(await runSyncNow());
      return true;
    } catch (e) {
      set({ loading: false, error: toAccountError(e) });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      await accountApi.logoutRemote();
    } catch {
      // Server-side revocation is best-effort; local sign-out always succeeds.
    } finally {
      setSyncListener(null);
      set({ user: null, loading: false, migration: "idle", lastSyncedAt: null });
      // Local data (corrections, settings) intentionally left fully intact.
    }
  },

  clearError: () => set({ error: null }),
}));

function onSyncOutcome(outcome: SyncOutcome) {
  void handleSyncResult({ outcome, pulled: 0 });
}

/**
 * Shared post-sync state update for login/signup flows AND the background
 * listener. Also detects a dead session: when the server has revoked the
 * refresh token, the client cleared its tokens (SESSION_EXPIRED path) — the
 * user must land in a clean signed-out state with a clear message, never a
 * silent state where the UI says "signed in" but sync quietly never works.
 */
async function handleSyncResult(result: { outcome: SyncOutcome; pulled: number }): Promise<void> {
  if (result.outcome === "ok" || result.outcome === "partial") {
    useAccount.setState({ lastSyncedAt: await loadLastSyncedAt() });
  }
  if (result.outcome !== "skipped" && !accountApi.isSignedIn()) {
    // Tokens were cleared server-side (revoked/expired refresh) — sign out.
    setSyncListener(null);
    useAccount.setState({
      user: null,
      migration: "idle",
      lastSyncedAt: null,
      error: {
        kind: "SESSION_EXPIRED",
        message: "Your session expired. Please log in again — everything on this device is safe.",
      },
    });
  }
}

function toAccountError(e: unknown): AccountError {
  if (isApiError(e)) {
    const kind: AccountErrorKind =
      e.code === "EMAIL_EXISTS"
        ? "EMAIL_EXISTS"
        : e.code === "INVALID_CREDENTIALS"
          ? "INVALID_CREDENTIALS"
          : e.code === "INVALID_EMAIL"
            ? "INVALID_EMAIL"
            : e.code === "WEAK_PASSWORD"
              ? "WEAK_PASSWORD"
              : e.code === "AUTH_NOT_CONFIGURED"
                ? "AUTH_NOT_CONFIGURED"
                : e.code === "SESSION_EXPIRED"
                  ? "SESSION_EXPIRED"
                  : e.status === 0
                    ? "NETWORK"
                    : e.status >= 500
                      ? "SERVER"
                      : "UNKNOWN";
    return { kind, message: e.userMessage };
  }
  const fallback = classifyAuthError(e);
  return { kind: fallback.status === 0 ? "NETWORK" : "SERVER", message: fallback.userMessage };
}
