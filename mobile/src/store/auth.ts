import { create } from "zustand";

import type { AuthUser, LoginParams, SignupParams } from "../api/auth";
import {
  signup as apiSignup,
  login as apiLogin,
  logout as apiLogout,
  restoreSession,
  resetPassword as apiResetPassword,
  onAuthStateChange,
} from "../api/auth";
import { isSupabaseConfigured } from "../api/supabase";
import type { ApiError } from "../api/errors";

export type AuthErrorKind =
  | "EMAIL_EXISTS"
  | "INVALID_CREDENTIALS"
  | "USER_NOT_FOUND"
  | "EMAIL_UNCONFIRMED"
  | "INVALID_PHONE"
  | "RATE_LIMITED"
  | "NETWORK"
  | "SIGNUP_FAILED"
  | "LOGIN_FAILED"
  | "LOGOUT_FAILED"
  | "RESET_FAILED"
  | "UNKNOWN";

export interface AuthError {
  kind: AuthErrorKind;
  message: string;
}

interface AuthState {
  /** The authenticated user, or null if not logged in. */
  user: AuthUser | null;
  /** True while checking for an existing session on app launch. */
  restoring: boolean;
  /** True while a signup/login/logout API call is in flight. */
  loading: boolean;
  /** The most recent auth error, or null. */
  error: AuthError | null;
  /** True once initial session check is complete and the app knows which
   *  screen to show (auth vs. main). Prevents a flash of login screen. */
  initialized: boolean;

  /** Check for an existing session on app launch. Call once in HydrationGate. */
  initialize: () => Promise<void>;
  /** Register a new account. */
  signup: (params: SignupParams) => Promise<void>;
  /** Sign in with email + password. */
  login: (params: LoginParams) => Promise<void>;
  /** Send password reset email. */
  resetPassword: (email: string) => Promise<void>;
  /** Sign out. */
  logout: () => Promise<void>;
  /** Clear the current error. */
  clearError: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  restoring: true,
  loading: false,
  error: null,
  initialized: false,

  initialize: async () => {
    // When Supabase credentials are placeholders, skip the network restore
    // entirely — the app shows auth screens but never hits the wire.
    if (!isSupabaseConfigured()) {
      set({ user: null, restoring: false, initialized: true });
      return;
    }

    try {
      const user = await restoreSession();
      set({ user, restoring: false, initialized: true });
    } catch {
      set({ user: null, restoring: false, initialized: true });
    }

    // Listen for auth state changes (token refresh, sign out from another tab, etc.)
    onAuthStateChange((user) => {
      set({ user });
    });
  },

  signup: async (params) => {
    set({ loading: true, error: null });
    try {
      const user = await apiSignup(params);
      set({ user, loading: false });
    } catch (e) {
      const apiErr = e as ApiError;
      set({
        loading: false,
        error: {
          kind: apiErr.code as AuthErrorKind,
          message: apiErr.userMessage,
        },
      });
    }
  },

  login: async (params) => {
    set({ loading: true, error: null });
    try {
      const user = await apiLogin(params);
      set({ user, loading: false });
    } catch (e) {
      const apiErr = e as ApiError;
      set({
        loading: false,
        error: {
          kind: apiErr.code as AuthErrorKind,
          message: apiErr.userMessage,
        },
      });
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      await apiResetPassword(email);
      set({ loading: false });
    } catch (e) {
      const apiErr = e as ApiError;
      set({
        loading: false,
        error: {
          kind: apiErr.code as AuthErrorKind,
          message: apiErr.userMessage,
        },
      });
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      await apiLogout();
      set({ user: null, loading: false });
    } catch (e) {
      const apiErr = e as ApiError;
      set({
        loading: false,
        error: {
          kind: apiErr.code as AuthErrorKind,
          message: apiErr.userMessage,
        },
      });
    }
  },

  clearError: () => set({ error: null }),
}));
