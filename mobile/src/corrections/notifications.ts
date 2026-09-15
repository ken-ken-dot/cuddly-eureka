import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { levelLabel } from "./proficiency";
import { useTracking } from "./tracking";
import { useCorrections } from "../store/corrections";
import { useSettings } from "../store/settings";

/**
 * V3 notifications — two local, on-device triggers, per the brief:
 *   1. a mistake repeats (the same curated wrong form kept more than once);
 *   2. a proficiency level is cleared (per-topic level rises vs. the last report).
 *
 * Both are detected client-side from data already in the app, so no push
 * backend is needed. The app must work fully with notifications denied or
 * disabled — every entry point checks the settings toggle and permission
 * first and degrades to a no-op.
 */

// Show alerts/banners even when the app is in the foreground (otherwise the
// two triggers would be invisible exactly when the user is using the app).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type V3Reason = "repeat-mistake" | "level-cleared";

const NOTIFY_TITLE = {
  "repeat-mistake": "That slip is back",
  "level-cleared": "Level cleared",
} as const;

function notify(reason: V3Reason, body: string, key: string): void {
  const { notificationsOn } = useSettings.getState();
  if (notificationsOn === false) return; // user toggle off — hard no-op

  void (async () => {
    try {
      // Bail silently if the user has notifications denied at the OS level.
      const settings = await Notifications.getPermissionsAsync();
      if (!settings.granted) return;

      const tracking = useTracking.getState();
      if (reason === "repeat-mistake") {
        if (tracking.repeatNotified.has(key)) return;
        tracking.repeatNotified.add(key);
      } else {
        if (tracking.levelNotified.has(key)) return;
        tracking.levelNotified.add(key);
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: NOTIFY_TITLE[reason],
          body,
          sound: false,
        },
        trigger: null, // fire immediately as a local notification
      });
    } catch {
      // Notifications must never break the translate/correct flow.
    }
  })();
}

/** Trigger 1 — the same wrong form has now been kept more than once. */
export function evaluateKeptMistake(entryId: string, right: string): void {
  void (async () => {
    try {
      const records = useCorrections.getState().corrections;
      const count = records.filter((r) => r.entryId === entryId).length;
      if (count < 2) return; // only on an actual repeat
      const topic = records.find((r) => r.entryId === entryId)?.topic ?? "general";
      const body = `You've kept “${right}” ${count} times now. Worth a little extra practice in ${topic.replace("-", " ")} — maybe try typing a few phrases with it.`;
      notify("repeat-mistake", body, entryId);
    } catch {
      // Never break the keep flow.
    }
  })();
}

/** Trigger 2 — a per-topic proficiency level has risen since the previous report. */
export function evaluateLevelCleared(report: {
  topics: ReadonlyArray<{ topic: string; level: 0 | 1 | 2 | 3 }>;
}): void {
  void (async () => {
    try {
      const previous = useTracking.getState().sessionStart;
      if (!previous) return; // no baseline this session — nothing to compare
      for (const tp of report.topics) {
        const before = previous.topics[tp.topic];
        if (before === undefined || tp.level <= before) continue;
        const key = `${tp.topic}:${tp.level}`;
          const tracking = useTracking.getState();
          if (tracking.levelNotified.has(key)) continue;
          tracking.levelNotified.add(key);
          const body = `Your “${tp.topic.replace("-", " ")}” progress indicator rose to ${levelLabel(tp.level)} — based on your own recent activity, not a formal score.`;
        notify("level-cleared", body, key);
      }
    } catch {
      // Never break whatever called this.
    }
  })();
}

/** Permission flow: explain in plain language first, then ask the OS. Returns
 * a short status string for display next to the Profile toggle. Mirrors V1's
 * plain-language-first privacy approach. */
export async function requestV3Notifications(): Promise<"granted" | "denied" | "unavailable"> {
  const { notificationsOn } = useSettings.getState();
  if (notificationsOn === false) return "denied";

  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("vuga-coaching", {
        name: "Coaching reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch {
      // Channel setup is best-effort; permission request still proceeds.
    }
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";

  if (!current.canAskAgain) {
    return "unavailable"; // permanently denied in system settings
  }

  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted ? "granted" : "denied";
}

/** Displayed next to the toggle so "off" is never ambiguous. */
export function notificationStatusLabel(status: "granted" | "denied" | "unavailable" | "unset"): string {
  switch (status) {
    case "granted":
      return "On — device will alert you";
    case "denied":
      return "Off — you can enable them in system settings";
    case "unavailable":
      return "Blocked in system settings — enable them there to use this";
    case "unset":
      return "Not asked yet";
  }
}
