import { useEffect } from "react";

import { useCorrections } from "./corrections";
import { useAccount } from "./account";
import { runSyncNow } from "./sync";

/**
 * Ongoing correction sync (brief Section 7, Learn screen): signed in, every
 * correction lands in AsyncStorage immediately (existing flow, untouched) and
 * this effect pushes it to Postgres in the background. Signed out, this is a
 * no-op and Learn is byte-for-byte identical to today.
 *
 * The listener is attached only while signed in, so sign-in/sign-out is the
 * circuit breaker. Sync calls collapse while one is running (engine guard).
 */
export function useBackgroundSync(): void {
  const user = useAccount((s) => s.user);
  const signedIn = Boolean(user);
  const corrections = useCorrections((s) => s.corrections);

  useEffect(() => {
    if (!signedIn) return;
    void runSyncNow();
  }, [signedIn, corrections]);
}
