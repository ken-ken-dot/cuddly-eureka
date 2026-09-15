import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ThemeTokens } from "../theme/tokens";
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
 * corrections (never a chat bubble). Perforation line separates the stub
 * (Keep action) from the body.
 */
export function Ticket({ tokens, wrong, right, tip, kept = false, onKeep }: TicketProps) {
  const t = tokens;
  return (
    <View
      accessible
      accessibilityLabel={`Correction. You said ${wrong}. Say ${right} instead. ${tip}`}
      style={[
        styles.ticket,
        { backgroundColor: t.surface3, borderColor: t.line, shadowColor: "#000" },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: t.inkDim }]}>YOU SAID</Text>
          <Text style={[styles.wrong, { color: t.rust }]}>{wrong}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: t.inkDim }]}>SAY</Text>
          <Text style={[styles.right, { color: t.moss }]}>{right}</Text>
        </View>
        {tip ? (
          <Text style={[styles.tip, { color: t.inkDim }]}>{tip}</Text>
        ) : null}
      </View>

      <View style={[styles.perf, { backgroundColor: t.surface2 }]}>
        <View style={[styles.notch, { backgroundColor: t.surface, top: -6, left: -6 }]} />
        <View style={[styles.notch, { backgroundColor: t.surface, top: -6, right: -6 }]} />
        <View style={[styles.dash, { borderBottomColor: t.line }]} />
      </View>

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={kept ? "Correction saved" : `Keep correction: say ${right} instead of ${wrong}`}
        accessibilityState={{ disabled: !!kept, selected: !!kept }}
        disabled={kept}
        onPress={onKeep}
        style={({ pressed }) => [
          styles.stub,
          { backgroundColor: kept ? t.mossSoft : t.rustSoft, opacity: pressed ? 0.8 : 1 },
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
    borderRadius: RADII.ticket,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    overflow: "hidden",
    elevation: 2,
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  body: {
    flex: 1,
    padding: SPACING.m,
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
    width: 64,
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
