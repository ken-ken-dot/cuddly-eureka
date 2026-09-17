import * as Haptics from "expo-haptics";

/**
 * Haptic cues for the mic-first interaction (V1 brief, interaction quality).
 * Every call is wrapped so missing engine support (web, some Android devices)
 * degrades to a silent no-op — haptics must never break the flow.
 */

/** Mic press — start listening. Light, inviting tick. */
export function hapticMicStart(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Mic press — stop listening / submit for translation. Slightly firmer close. */
export function hapticMicStop(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** A translation completed successfully. Quiet success notification. */
export function hapticSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/** A correction was kept to the phrasebook. Same success family, lighter use. */
export function hapticKept(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/** Something went wrong (error bar shown). Distinct warning buzz. */
export function hapticError(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

/** Toggle/segment selection — the quiet tick for the language switch. */
export function hapticSelection(): void {
  void Haptics.selectionAsync().catch(() => undefined);
}
