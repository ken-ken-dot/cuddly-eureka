import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

/**
 * Supabase URL and anon key — set these in your .env or hardcode for now.
 * In production these should come from env vars, but Expo managed workflow
 * doesn't support .env natively without a plugin, so we expose them as
 * module-level constants that can be swapped later.
 */
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

/**
 * Expo SecureStore adapter for Supabase — stores JWT tokens in the platform's
 * secure enclave (iOS Keychain / Android Keystore) instead of AsyncStorage.
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: async (key: string) => SecureStore.deleteItemAsync(key),
};

/**
 * Returns true when real Supabase credentials are in place.
 * When false, all auth API calls are no-ops — the app shows the auth
 * screens but never hits the network.
 */
export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
    SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY"
  );
}

/**
 * Lazy-initialized Supabase client. Created on first access so that module
 * load never throws — the old eager `createClient(…) at the top level
 * crashed the entire import chain when the URL was a placeholder like
 * "YOUR_SUPABASE_URL", which is not a valid URL. That crash was the root
 * cause of the blank white screen on app load.
 *
 * When Supabase is not configured, the client is still created (auth
 * methods are never called because `isSupabaseConfigured()` gates them),
 * but the URL must be a syntactically valid one.
 */
let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;
  try {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch {
    // Placeholder URLs are not valid — create a stub with a dummy URL so
    // module imports don't break. No auth methods will be called because
    // `isSupabaseConfigured()` returns false.
    _supabase = createClient("https://placeholder.supabase.co", SUPABASE_ANON_KEY, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _supabase;
}

/**
 * Proxy so existing `import { supabase } from …` call-sites keep working
 * without changes. Every property access is forwarded to the lazy client.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
