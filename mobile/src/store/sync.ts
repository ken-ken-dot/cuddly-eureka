import AsyncStorage from "@react-native-async-storage/async-storage";

import * as accountApi from "../api/account";
import { useCorrections, persistForSync, type CorrectionRecord } from "./corrections";
import { useSettings } from "./settings";

/**
 * Sync engine (brief Sections 6-7). AsyncStorage stays the source of truth
 * for the immediate UI; Postgres (via the proxy) is the backup/sync layer.
 *
 * Design invariants:
 *  - Signed-out: engine is dormant. Nothing in the existing flow touches it.
 *  - Local first: corrections land in AsyncStorage instantly (existing
 *    behavior, unchanged); sync is always a background, best-effort step.
 *  - Never destructive: merging cloud rows down only ADDS records missing
 *    locally (matched by localId); local records are never modified or
 *    removed by a pull, so a device can't lose data via a bad merge.
 *  - Idempotent: uploads dedupe server-side by (user, localId), so retries
 *    and repeated syncs never duplicate rows.
 *  - Push on change, pull once per sign-in: daily-life flow is push-only;
 *    other devices' rows arrive on login/restore and after our own pushes.
 */

const LAST_SYNC_KEY = "vuga.account.lastSyncedAt";
const SETTINGS_APPLIED_KEY = "vuga.account.cloudSettingsApplied";

export type SyncOutcome = "ok" | "partial" | "failed" | "skipped";

export type SyncListener = (outcome: SyncOutcome) => void;

let listener: SyncListener | null = null;

export function setSyncListener(fn: SyncListener | null): void {
  listener = fn;
}

function notify(outcome: SyncOutcome): void {
  const fn = listener;
  if (!fn) return;
  try {
    fn(outcome);
  } catch {
    /* listener errors never break the engine */
  }
}

// --- Last-synced timestamp (Profile's "Last backed up …" line) ---------------

export async function loadLastSyncedAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export async function storeLastSyncedAt(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {
    /* cosmetic — ignore */
  }
}

// --- Settings-applied marker (one-time pull of cloud settings) ----------------

export async function hasCloudSettingsBeenApplied(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SETTINGS_APPLIED_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markCloudSettingsApplied(): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_APPLIED_KEY, "1");
  } catch {
    /* cosmetic — ignore */
  }
}

// --- Corrections persistence -------------------------------------------------
// Merged lists are persisted through the corrections store's narrow write path
// (persistForSync) so AsyncStorage's key lives in exactly one file.

/** Pair code for upload: translation codes joined by a dash (rw-zh, rw-en…). */
function pairFor(sourceLang: string, targetLang: string): string {
  const short = (code: string) => (code.toLowerCase() === "zh-cn" ? "zh" : code.toLowerCase());
  return `${short(sourceLang)}-${short(targetLang)}`;
}

/** Inverse of pairFor: pair side ("rw"|"zh"|"en"|"de") -> proxy language code. */
function langFromPairSide(side: string | undefined): string {
  switch (side) {
    case "zh":
      return "zh-CN";
    case "en":
      return "en";
    case "de":
      return "de";
    default:
      return "rw";
  }
}

// --- The sync itself ----------------------------------------------------------

/** Upload every local correction; returns rows not confirmed server-side. */
async function pushAll(): Promise<boolean> {
  const local = useCorrections.getState().corrections;
  if (local.length === 0) return true;
  const uploads = local.map((r) => ({
    localId: r.id,
    wrong: r.wrong,
    right: r.right,
    tip: r.tip,
    // Multilingual brief Section 6: derive the pair from the record's actual
    // languages so mixed-language history syncs correctly. V1 records carry
    // rw/zh-CN and still produce "rw-zh" — byte-identical to before.
    languagePair: pairFor(r.sourceLang, r.targetLang),
    createdAt: r.createdAt,
  }));
  await accountApi.pushCorrections(uploads);
  return true;
}

/** Add cloud-only rows to local storage. Purely additive merge. */
async function pullAndMerge(): Promise<number> {
  const cloud = await accountApi.fetchCorrections();
  const state = useCorrections.getState();
  const knownIds = new Set(state.corrections.map((c) => c.id));
  const incoming = cloud
    .filter((c) => !c.localId || !knownIds.has(c.localId))
    .map<CorrectionRecord>((c) => {
      // Split the stored pair back into languages. Cloud rows from V1 (or
      // from any legacy client) carry rw-zh and resolve exactly as before.
      const [s, t] = (c.languagePair ?? "rw-zh").split("-");
      return {
        id: c.localId ?? `srv_${c.id}`,
        wrong: c.wrong,
        right: c.right,
        tip: c.tip,
        sourceLang: langFromPairSide(s),
        targetLang: langFromPairSide(t),
        createdAt: c.createdAt,
        topic: c.topic as string | undefined,
      };
    });
  if (incoming.length === 0) return 0;
  const merged = [...state.corrections, ...incoming]
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
    .sort((a, b) => b.createdAt - a.createdAt);
  useCorrections.setState({ corrections: merged });
  void persistForSync(merged);
  return incoming.length;
}

/** Best-effort settings sync: push local up; pull cloud down once per device. */
async function syncSettings(): Promise<void> {
  const s = useSettings.getState();
  try {
    const applied = await hasCloudSettingsBeenApplied();
    if (!applied) {
      const cloud = await accountApi.fetchSettings();
      if (cloud && (cloud.theme === "dark" || cloud.theme === "light" || cloud.theme === "system")) {
        // One-time adoption of cloud settings on a new device, then mark so
        // local settings win from here on (per brief: local is source of truth
        // for immediate UI; cloud is the backup layer).
        s.setThemeMode(cloud.theme);
      }
      await markCloudSettingsApplied();
    }
    await accountApi.pushSettings(s.themeMode, "rw-zh"); // default pair; settings UI stays V1-scoped
  } catch {
    // Settings sync is best-effort; never blocks correction sync.
  }
}

let syncing = false;

/**
 * Run one full sync pass. Safe to call fire-and-forget; concurrent calls
 * collapse into the running one. Returns what happened, and whether any
 * cloud-only rows were merged down.
 */
export async function runSyncNow(): Promise<{ outcome: SyncOutcome; pulled: number }> {
  if (!accountApi.isSignedIn()) return { outcome: "skipped", pulled: 0 };
  if (syncing) return { outcome: "skipped", pulled: 0 };
  syncing = true;
  try {
    let ok = true;
    let pulled = 0;
    try {
      await pushAll();
    } catch {
      ok = false;
    }
    try {
      pulled = await pullAndMerge();
    } catch {
      ok = false;
    }
    await syncSettings();
    const outcome: SyncOutcome = ok ? "ok" : "partial";
    await storeLastSyncedAt();
    notify(outcome);
    return { outcome, pulled };
  } finally {
    syncing = false;
  }
}
