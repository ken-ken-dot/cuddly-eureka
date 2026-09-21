import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { ThemeTokens } from "../theme/tokens";
import { hapticSelection } from "../theme/haptics";
import {
  DIRECTIONS,
  directionLabel,
  directionSideLabel,
  type Direction,
} from "../types";

interface LanguagePickerProps {
  tokens: ThemeTokens;
  value: Direction;
  onChange: (d: Direction) => void;
}

/**
 * Multilingual brief Section 5: source/target picker limited to exactly the
 * four verified languages (pairs from DIRECTIONS — no open-ended "any
 * language" mode). Kinyarwanda⇄Mandarin remains the first option and renders
 * its V1 labels untouched.
 *
 * Same visual language as LanguageToggle: pill track, ochre selection, tiny
 * tracked-out caps. Collapses to the plain two-segment toggle when the user
 * hasn't opened the swap sheet, so the default screen looks like V1.
 */
export function LanguagePicker({ tokens: t, value, onChange }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);

  const currentSides = value.split("-");

  const pick = (d: Direction) => {
    setOpen(false);
    if (d !== value) {
      hapticSelection();
      onChange(d);
    }
  };

  return (
    <View accessible accessibilityRole="tablist" accessibilityLabel="Translation languages">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Languages: ${directionLabel(value)}. Tap to change.`}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [
          styles.track,
          { backgroundColor: t.cardIn, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Text style={[styles.arrow, { color: t.inkDim }]}>⇄</Text>
        <Text numberOfLines={1} style={[styles.label, { color: t.ink }]}>
          {directionLabel(value)}
        </Text>
        <Text style={[styles.chevron, { color: t.inkDim }]}>{open ? "▾" : "▸"}</Text>
      </Pressable>

      {open ? (
        <View style={[styles.sheet, { backgroundColor: t.surface2, borderColor: t.line }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetRow}>
            {DIRECTIONS.map((d) => {
              const active = d === value;
              const [s = "", tgt = ""] = d.split("-");
              return (
                <Pressable
                  key={d}
                  accessible
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={directionLabel(d)}
                  onPress={() => pick(d)}
                  style={({ pressed }) => [
                    styles.pill,
                    { borderColor: t.line, backgroundColor: t.card, opacity: pressed && !active ? 0.8 : 1 },
                    active ? { backgroundColor: t.ochre, borderColor: t.ochre } : null,
                  ]}
                >
                  <Text style={[styles.pillSide, { color: active ? t.surface : t.inkDim }]}>
                    {directionSideLabel(s)}
                  </Text>
                  <Text style={[styles.pillArrow, { color: active ? t.surface : t.inkDim }]}>→</Text>
                  <Text style={[styles.pillSide, { color: active ? t.surface : t.inkDim }]}>
                    {directionSideLabel(tgt)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[styles.hint, { color: t.inkDim }]}>
            Verified pairs only for now — {currentSides.length === 2 ? "speech works across all of these" : "speech works across all of these"}.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignSelf: "center",
    maxWidth: "100%",
  },
  arrow: { fontSize: 13, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3, flexShrink: 1 },
  chevron: { fontSize: 11, fontWeight: "700" },
  sheet: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  sheetRow: { flexDirection: "row", gap: 6, paddingHorizontal: 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillSide: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  pillArrow: { fontSize: 10, fontWeight: "700" },
  hint: { fontSize: 10, marginTop: 6, paddingHorizontal: 6 },
});
