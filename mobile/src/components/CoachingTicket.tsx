import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PhosphorIcon } from "./PhosphorIcon";
import { Chats, Sparkle } from "phosphor-react-native";
import type { ThemeTokens } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { RADII, SPACING, TYPE } from "../theme/tokens";
import type { CoachingInfo } from "../types";

/**
 * V3 typed-text coaching — same Ticket-style presentation the spoken-correction
 * flow already uses, so "here's what to fix" looks the same whether it came
 * from speech or typing (per the V3 brief, Section 5).
 *
 * Two shapes:
 *   - kind "mistake": a compact coaching line rendered directly above the
 *     turn's existing correction Ticket (which keeps its KEEP action) — the
 *     ticket itself is never duplicated.
 *   - kind "clean": no mistake to show — a progress ticket in the same punched
 *     style, with the topic's level and the honest coverage caveat.
 *
 * Coverage caveat (same honesty as Learn's note): "nothing from the curated
 * list" means nothing this small list can see — it is never a claim that the
 * phrase was otherwise correct.
 */
export function CoachingTicket({ tokens, coaching }: { tokens: ThemeTokens; coaching: CoachingInfo }) {
  const t = tokens;

  if (coaching.kind === "mistake") {
    // The correction Ticket for this mistake is rendered separately by the
    // turn (with its KEEP action); this is just the coaching header for it.
    return (
      <View
        accessible
        accessibilityLabel={`Coaching. You typed ${coaching.wrong}. Say ${coaching.right} instead. ${coaching.tip}`}
      >
        <View style={styles.mistakeHeader}>
          <PhosphorIcon icon={Chats} size={14} color={t.ochre} />
          <Text style={[styles.line, { color: t.inkDim }]}>
            {coaching.practicedBefore ? "You've kept this fix before" : "Coaching"}
            {" — "}
            {coaching.line}
          </Text>
        </View>
        <TopicTag tokens={t} topic={coaching.topic} />
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`Coaching. ${coaching.line} Progress level in ${coaching.topic ?? "general"}: ${coaching.levelText ?? "just starting"}. ${coaching.tip}`}
      style={[styles.ticket, { backgroundColor: t.card, borderColor: t.line }, elevate("card", t)]}
    >
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <PhosphorIcon icon={Sparkle} size={16} color={t.moss} />
          <Text style={[styles.headerLabel, { color: t.inkDim }]}>COACHING</Text>
        </View>
        <Text style={[styles.line, { color: t.ink }]}>{coaching.line}</Text>
        <Text style={[styles.level, { color: t.moss }]}>
          {coaching.topic ? `${coaching.topic.replace("-", " ")} — ` : ""}
          {coaching.levelText ?? "just starting"}
          {typeof coaching.clean === "number" && coaching.clean > 0 ? ` · ${coaching.clean} clean exchange${coaching.clean === 1 ? "" : "s"}` : ""}
        </Text>
        <Text style={[styles.tip, { color: t.inkDim }]}>{coaching.tip}</Text>
      </View>
      <View style={[styles.perf, { backgroundColor: t.cardIn }]}>
        <View style={[styles.notch, { backgroundColor: t.surface, top: -6, left: -6 }]} />
        <View style={[styles.notch, { backgroundColor: t.surface, top: -6, right: -6 }]} />
        <View style={[styles.dash, { borderLeftColor: t.line }]} />
      </View>
      <View style={[styles.stub, { backgroundColor: t.mossSoft }]}>
        <Text style={[styles.stubText, { color: t.ink }]}>PROGRESS</Text>
      </View>
    </View>
  );
}

function TopicTag({ tokens, topic }: { tokens: ThemeTokens; topic?: string }) {
  if (!topic) return null;
  return <Text style={[styles.topicTag, { color: tokens.inkDim }]}>Topic: {topic.replace("-", " ")}</Text>;
}

const styles = StyleSheet.create({
  line: { fontSize: TYPE.small, lineHeight: 18, marginBottom: SPACING.xs, flex: 1 },
  mistakeHeader: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  topicTag: { fontSize: TYPE.tiny, marginTop: SPACING.xs },
  ticket: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    overflow: "hidden",
  },
  body: { flex: 1, padding: SPACING.m, gap: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.xs },
  headerLabel: { fontSize: TYPE.tiny, letterSpacing: 1.5, fontWeight: "700" },
  level: { fontSize: TYPE.small, fontWeight: "700" },
  tip: { fontSize: TYPE.small, lineHeight: 18 },
  perf: { width: 14, justifyContent: "center", alignItems: "center" },
  dash: { position: "absolute", left: 6, right: 0, top: 0, bottom: 0, borderLeftWidth: 1, borderStyle: "dashed" },
  notch: { position: "absolute", width: 12, height: 12, borderRadius: 6 },
  stub: { width: 84, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.s },
  stubText: { fontSize: TYPE.small, fontWeight: "800", letterSpacing: 1 },
});
