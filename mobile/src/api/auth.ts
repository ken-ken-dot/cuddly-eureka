import { supabase } from "./supabase";
import { ApiError } from "./errors";

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  country: string | null;
}

export interface SignupParams {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  country: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

/**
 * Register a new user with Supabase Auth + metadata.
 * Stores profile data in user_metadata so it travels with the JWT.
 */
export async function signup(params: SignupParams): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        full_name: params.fullName,
        phone: params.phone,
        country: params.country,
      },
    },
  });

  if (error) {
    const code = error.message.toLowerCase();
    if (code.includes("already") || code.includes("registered")) {
      throw new ApiError("EMAIL_EXISTS", "An account with this email already exists. Log in instead.", 409);
    }
    if (code.includes("phone")) {
      throw new ApiError("INVALID_PHONE", "That phone number doesn't look right. Check the number and try again.", 400);
    }
    if (code.includes("rate") || code.includes("too many")) {
      throw new ApiError("RATE_LIMITED", "Too many attempts. Please wait a few minutes before trying again.", 429);
    }
    throw new ApiError("SIGNUP_FAILED", error.message, 400);
  }

  if (!data.user) {
    throw new ApiError("SIGNUP_FAILED", "Signup succeeded but no user was returned. Try logging in.", 500);
  }

  return toAuthUser(data.user);
}

/**
 * Sign in with email + password.
 */
export async function login(params: LoginParams): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });

  if (error) {
    const code = error.message.toLowerCase();
    if (code.includes("invalid login") || code.includes("invalid email") || code.includes("wrong password")) {
      throw new ApiError("INVALID_CREDENTIALS", "Email or password is incorrect. Please try again.", 401);
    }
    if (code.includes("not found") || code.includes("no user")) {
      throw new ApiError("USER_NOT_FOUND", "No account found with this email. Sign up first.", 404);
    }
    if (code.includes("email not confirmed")) {
      throw new ApiError("EMAIL_UNCONFIRMED", "Please confirm your email address before logging in.", 403);
    }
    if (code.includes("rate") || code.includes("too many")) {
      throw new ApiError("RATE_LIMITED", "Too many login attempts. Please wait before trying again.", 429);
    }
    throw new ApiError("LOGIN_FAILED", error.message, 400);
  }

  if (!data.user) {
    throw new ApiError("LOGIN_FAILED", "Login succeeded but no user was returned.", 500);
  }

  return toAuthUser(data.user);
}

/**
 * Send a password reset email.
 */
export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "vuga://reset-password",
  });
  if (error) {
    throw new ApiError("RESET_FAILED", "Could not send reset email. Check the address and try again.", 400);
  }
}

/**
 * Sign out — clears the secure-stored session.
 */
export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new ApiError("LOGOUT_FAILED", "Could not sign out. Please try again.", 500);
  }
}

/**
 * Get the current session if one exists (silent restore on app launch).
 * Returns null if no valid session.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return null;
  }

  // Verify the session is still valid by calling getUser.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return null;
  }

  return toAuthUser(userData.user);
}

/**
 * Subscribe to auth state changes (login/logout/token refresh).
 */
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback(toAuthUser(session.user));
    } else {
      callback(null);
    }
  });
}

function toAuthUser(user: { id: string; email?: string | null; phone?: string | null; user_metadata?: Record<string, unknown> }): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    fullName: (user.user_metadata?.full_name as string) ?? null,
    country: (user.user_metadata?.country as string) ?? null,
  };
}
