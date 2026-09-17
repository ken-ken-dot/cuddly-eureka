import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PhosphorIcon } from "./PhosphorIcon";
import { Sparkle, CheckCircle } from "phosphor-react-native";
import type { ThemeTokens } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { hapticKept } from "../theme/haptics";
import { RADII, SPACING, TYPE } from "../theme/tokens";

interface TicketProps {
  tokens: ThemeTokens;
  wrong: string;
  right: string;
  tip: string;
  kept?: boolean;
  onKeep?: () => void;
}

/**
 * A correction rendered as a punched ticket stub — the brand element for
 * corrections (never a chat bubble), now with a signature icon header so the
 * feature reads as a deliberate product moment. Perforation line separates
 * the stub (Keep action) from the body.
 */
export function Ticket({ tokens, wrong, right, tip, kept = false, onKeep }: TicketProps) {
  const t = tokens;
  return (
    <View
      accessible
      accessibilityLabel={`Correction. You said ${wrong}. Say ${right} instead. ${tip}`}
      style={[styles.ticket, { backgroundColor: t.card, borderColor: t.line }, elevate("card", t)]}
    >
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <PhosphorIcon icon={kept ? CheckCircle : Sparkle} size={16} color={kept ? t.moss : t.ochre} />
          <Text style={[styles.headerLabel, { color: t.inkDim }]}>
            {kept ? "KEPT — WORD TO FIX" : "WORD TO FIX"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: t.inkDim }]}>YOU SAID</Text>
          <Text style={[styles.wrong, { color: t.rust }]}>{wrong}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: t.inkDim }]}>SAY INSTEAD</Text>
          <Text style={[styles.right, { color: t.moss }]}>{right}</Text>
        </View>
        {tip ? <Text style={[styles.tip, { color: t.inkDim }]}>{tip}</Text> : null}
      </View>

      <View style={[styles.perf, { backgroundColor: t.cardIn }]}>
        <View style={[styles.notch, { backgroundColor: t.surface, top: -6, left: -6 }]} />
        <View style={[styles.notch, { backgroundColor: t.surface, top: -6, right: -6 }]} />
        <View style={[styles.dash, { borderLeftColor: t.line }]} />
      </View>

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={kept ? "Correction saved" : `Keep correction: say ${right} instead of ${wrong}`}
        accessibilityState={{ disabled: !!kept, selected: !!kept }}
        disabled={kept}
        onPress={() => {
          if (!kept) {
            hapticKept();
            onKeep?.();
          }
        }}
        style={({ pressed }) => [
          styles.stub,
          { backgroundColor: kept ? t.mossSoft : t.rustSoft, opacity: pressed && !kept ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.stubText, { color: t.ink }]}>
          {kept ? "KEPT ✓" : "KEEP"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    overflow: "hidden",
  },
  body: {
    flex: 1,
    padding: SPACING.m,
    gap: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: SPACING.s,
  },
  headerLabel: {
    fontSize: TYPE.tiny,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: SPACING.s,
    marginBottom: SPACING.xs,
  },
  label: {
    fontSize: TYPE.tiny,
    letterSpacing: 1,
    fontWeight: "700",
    width: 84,
  },
  wrong: {
    fontSize: TYPE.body,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  right: {
    fontSize: TYPE.body,
    fontWeight: "700",
  },
  tip: {
    fontSize: TYPE.small,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  perf: {
    width: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  dash: {
    position: "absolute",
    left: 6,
    right: 0,
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderStyle: "dashed",
  },
  notch: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stub: {
    width: 84,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.s,
  },
  stubText: {
    fontSize: TYPE.small,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
