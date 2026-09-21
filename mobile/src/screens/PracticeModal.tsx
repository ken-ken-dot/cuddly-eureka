import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { RADII, SPACING, TYPE } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { Logo } from "../components/Logo";
import { PhosphorIcon } from "../components/PhosphorIcon";
import { CheckCircle, Warning, X } from "phosphor-react-native";
import { hapticSuccess, hapticError, hapticSelection } from "../theme/haptics";
import { useAccount } from "../store/account";
import * as accountApi from "../api/account";

type Phase = "loading" | "drill" | "feedback" | "summary" | "signedout" | "empty" | "error";

interface SessionCounts {
  reviewed: number;
  correct: number;
}

/**
 * Practice drill flow (learning brief Section 6): a focused, single-purpose
 * modal — you enter, drill the items that are due, see a summary, and leave.
 * One item at a time: the wrong form shows as the prompt; the user recalls
 * and picks the correct version among look-alike options; immediate feedback
 * uses the existing Ticket visual language (YOU SAID / SAY INSTEAD). Each
 * answer is submitted to the proxy, which owns the SM-2 scheduling state.
 *
 * Signed-out users see a gentle sign-in prompt here (brief Section 5) — the
 * app keeps working; practice is additive.
 */
export function PracticeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { tokens: t } = useTheme();
  const user = useAccount((s) => s.user);

  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<accountApi.DrillItem[]>([]);
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [counts, setCounts] = useState<SessionCounts>({ reviewed: 0, correct: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const current = items[index] as accountApi.DrillItem | undefined;

  // Build look-alike options: the correct form + "right" forms from other kept
  // items (same topic family the user actually makes mistakes in). Never
  // invent distractors.
  useEffect(() => {
    if (!current) return;
    const pool = items.map((i) => i.right).filter((r) => r !== current.right);
    const distractors: string[] = [];
    for (const candidate of pool) {
      if (distractors.length >= 2) break;
      if (!distractors.includes(candidate)) distractors.push(candidate);
    }
    // With 1-2 kept items there aren't enough distinct forms — pad from the
    // same item set with shuffled wrongs so the answer is never the only option.
    while (distractors.length < 2 && items.length > 1) {
      const candidate = items[Math.floor(Math.random() * items.length)]?.wrong;
      if (candidate && candidate !== current.right && !distractors.includes(candidate)) {
        distractors.push(candidate);
      } else {
        break;
      }
    }
    setChoices(shuffle([current.right, ...distractors]));
    setChosen(null);
  }, [current, items]);

  const load = useCallback(async () => {
    setPhase("loading");
    setCounts({ reviewed: 0, correct: 0 });
    setIndex(0);
    try {
      const due = await accountApi.fetchDueItems(12);
      setItems(due);
      setPhase(due.length === 0 ? "empty" : "drill");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (visible) {
      if (user) void load();
      else setPhase("signedout");
    }
  }, [visible, user, load]);

  const answer = useCallback(
    async (choice: string) => {
      if (!current) return;
      const wasCorrect = choice === current.right;
      setChosen(choice);
      setPhase("feedback");
      if (wasCorrect) hapticSuccess();
      else hapticError();
      setCounts((c) => ({ reviewed: c.reviewed + 1, correct: c.correct + (wasCorrect ? 1 : 0) }));
      try {
        await accountApi.submitReview(current.id, wasCorrect);
      } catch {
        // Feedback stays truthful either way; a failed write is retried on
        // the next session load (server state remains authoritative).
      }
    },
    [current],
  );

  const next = useCallback(() => {
    hapticSelection();
    if (index + 1 >= items.length) {
      setPhase("summary");
    } else {
      setIndex((i) => i + 1);
      setPhase("drill");
    }
  }, [index, items.length]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={[styles.safe, { backgroundColor: t.surface }]} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSide} />
          <Logo size={26} ochre={t.ochre} rust={t.rust} />
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close practice">
            <PhosphorIcon icon={X} size={22} color={t.inkDim} weight="bold" />
          </Pressable>
        </View>

        {phase === "loading" && (
          <View style={styles.center}>
            <ActivityIndicator color={t.ochre} size="large" />
            <Text style={[styles.centerText, { color: t.inkDim }]}>Loading your practice items…</Text>
          </View>
        )}

        {phase === "signedout" && (
          <ScrollView contentContainerStyle={styles.centerPad}>
            <View style={[styles.sheetCard, { backgroundColor: t.surface2, borderColor: t.line }, elevate("card", t)]}>
              <PhosphorIcon icon={CheckCircle} size={28} color={t.ochre} />
              <Text style={[styles.sheetTitle, { color: t.ink }]}>Practice needs an account</Text>
              <Text style={[styles.sheetBody, { color: t.inkDim }]}>
                Practice keeps track of what to show you next — so your progress is saved and follows
                you across devices. Everything else in VUGA works without one.
              </Text>
              <Pressable
                onPress={() => {
                  close();
                  useAccount.setState({ authSheet: "signup" });
                }}
                style={[styles.primaryButton, { backgroundColor: t.ochre }, elevate("float", t)]}
                accessibilityRole="button"
                accessibilityLabel="Save your progress and get proper practice"
              >
                <Text style={[styles.primaryButtonText, { color: t.surface }]}>Save my progress</Text>
              </Pressable>
              <Pressable onPress={close} hitSlop={8}>
                <Text style={[styles.laterText, { color: t.inkDim }]}>Maybe later</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {phase === "empty" && (
          <View style={styles.center}>
            <PhosphorIcon icon={CheckCircle} size={32} color={t.moss} />
            <Text style={[styles.centerTitle, { color: t.ink }]}>Nothing due right now</Text>
            <Text style={[styles.centerText, { color: t.inkDim }]}>
              You're on top of your mistakes. Come back tomorrow — items you keep on the Translate
              tab will appear here.
            </Text>
            <Pressable onPress={close} style={[styles.primaryButton, { backgroundColor: t.moss }]}>
              <Text style={[styles.primaryButtonText, { color: t.surface }]}>Done</Text>
            </Pressable>
          </View>
        )}

        {phase === "error" && (
          <View style={styles.center}>
            <PhosphorIcon icon={Warning} size={32} color={t.rust} />
            <Text style={[styles.centerTitle, { color: t.ink }]}>Couldn't load practice</Text>
            <Text style={[styles.centerText, { color: t.inkDim }]}>{errorMessage}</Text>
            <Pressable onPress={() => void load()} style={[styles.primaryButton, { backgroundColor: t.ochre }]}>
              <Text style={[styles.primaryButtonText, { color: t.surface }]}>Try again</Text>
            </Pressable>
            <Pressable onPress={close} hitSlop={8}>
              <Text style={[styles.laterText, { color: t.inkDim }]}>Not now</Text>
            </Pressable>
          </View>
        )}

        {phase === "drill" && current && (
          <View style={styles.drillWrap}>
            <Text style={[styles.progressLine, { color: t.inkDim }]}>
              {index + 1} of {items.length}
            </Text>
            <View style={[styles.drillCard, { backgroundColor: t.card, borderColor: t.line }, elevate("card", t)]}>
              <Text style={[styles.drillLabel, { color: t.inkDim }]}>YOU SAID</Text>
              <Text style={[styles.drillWrong, { color: t.rust }]}>{current.wrong}</Text>
              <Text style={[styles.drillPrompt, { color: t.ink }]}>What's the right way to say it?</Text>
            </View>
            {choices.map((choice) => (
              <Pressable
                key={choice}
                onPress={() => void answer(choice)}
                style={({ pressed }) => [
                  styles.choice,
                  { backgroundColor: pressed ? t.surface3 : t.surface2, borderColor: t.line },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Say: ${choice}`}
              >
                <Text style={[styles.choiceText, { color: t.ink }]}>{choice}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {phase === "feedback" && current && (
          <View style={styles.drillWrap}>
            <Text style={[styles.progressLine, { color: t.inkDim }]}>
              {index + 1} of {items.length}
            </Text>
            {/* Feedback reuses the Ticket's exact body pattern (brief §6). */}
            <View style={[styles.feedbackCard, { backgroundColor: t.card, borderColor: t.line }, elevate("card", t)]}>
              <View style={styles.feedbackHeader}>
                <PhosphorIcon icon={chosen === current.right ? CheckCircle : Warning} size={18} color={chosen === current.right ? t.moss : t.rust} />
                <Text
                  style={[
                    styles.feedbackLabel,
                    { color: chosen === current.right ? t.moss : t.rust },
                  ]}
                >
                  {chosen === current.right ? "GOT IT" : "NOT QUITE"}
                </Text>
              </View>
              <View style={styles.ticketRow}>
                <Text style={[styles.ticketLabel, { color: t.inkDim }]}>YOU SAID</Text>
                <Text style={[styles.ticketWrong, { color: t.rust }]}>{current.wrong}</Text>
              </View>
              <View style={styles.ticketRow}>
                <Text style={[styles.ticketLabel, { color: t.inkDim }]}>SAY INSTEAD</Text>
                <Text style={[styles.ticketRight, { color: t.moss }]}>{current.right}</Text>
              </View>
              <Text style={[styles.ticketTip, { color: t.inkDim }]}>{current.tip}</Text>
            </View>
            <Pressable
              onPress={next}
              style={[styles.primaryButton, { backgroundColor: t.ochre }, elevate("float", t)]}
            >
              <Text style={[styles.primaryButtonText, { color: t.surface }]}>Continue</Text>
            </Pressable>
          </View>
        )}

        {phase === "summary" && (
          <View style={styles.center}>
            <PhosphorIcon icon={CheckCircle} size={32} color={t.moss} />
            <Text style={[styles.centerTitle, { color: t.ink }]}>Session done</Text>
            <Text style={[styles.summaryNumbers, { color: t.ink }]}>
              {counts.correct} of {counts.reviewed} correct
            </Text>
            <Text style={[styles.centerText, { color: t.inkDim }]}>
              {counts.correct === counts.reviewed
                ? "Every one right. These will come back less often."
                : "The ones that tripped you up will come back sooner."}
            </Text>
            <Pressable onPress={close} style={[styles.primaryButton, { backgroundColor: t.ochre }]}>
              <Text style={[styles.primaryButtonText, { color: t.surface }]}>Done</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.s,
  },
  headerSide: { width: 34 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.s, padding: SPACING.l },
  centerPad: { flex: 1, justifyContent: "center", padding: SPACING.l },
  centerTitle: { fontSize: TYPE.h2, fontWeight: "800", marginTop: SPACING.xs },
  centerText: { fontSize: TYPE.small, lineHeight: 18, textAlign: "center" },
  sheetCard: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.l,
    alignItems: "center",
    gap: SPACING.s,
  },
  sheetTitle: { fontSize: TYPE.h2, fontWeight: "800", textAlign: "center" },
  sheetBody: { fontSize: TYPE.small, lineHeight: 18, textAlign: "center" },
  primaryButton: {
    borderRadius: RADII.button,
    paddingVertical: 12,
    paddingHorizontal: SPACING.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    marginTop: SPACING.s,
  },
  primaryButtonText: { fontSize: TYPE.body, fontWeight: "800" },
  laterText: { fontSize: TYPE.small, fontWeight: "600", marginTop: SPACING.s },
  drillWrap: { flex: 1, padding: SPACING.m, gap: SPACING.s },
  progressLine: { fontSize: TYPE.tiny, fontWeight: "700", letterSpacing: 1 },
  drillCard: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.l,
    gap: 6,
  },
  drillLabel: { fontSize: TYPE.tiny, fontWeight: "700", letterSpacing: 1 },
  drillWrong: { fontSize: TYPE.display - 4, fontWeight: "800", textDecorationLine: "line-through" },
  drillPrompt: { fontSize: TYPE.body, marginTop: SPACING.xs },
  choice: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: "center",
  },
  choiceText: { fontSize: TYPE.body, fontWeight: "700" },
  feedbackCard: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.l,
    gap: 6,
  },
  feedbackHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.xs },
  feedbackLabel: { fontSize: TYPE.tiny, fontWeight: "700", letterSpacing: 1.5 },
  ticketRow: { flexDirection: "row", alignItems: "baseline", gap: SPACING.s },
  ticketLabel: { fontSize: TYPE.tiny, fontWeight: "700", letterSpacing: 1, width: 84 },
  ticketWrong: { fontSize: TYPE.body, fontWeight: "700", textDecorationLine: "line-through" },
  ticketRight: { fontSize: TYPE.body, fontWeight: "700" },
  ticketTip: { fontSize: TYPE.small, lineHeight: 18, marginTop: SPACING.xs },
  summaryNumbers: { fontSize: TYPE.display - 8, fontWeight: "800" },
});
