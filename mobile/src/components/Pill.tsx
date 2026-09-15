import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import type { ThemeTokens } from "../theme/tokens";
import { RADII, SPACING, TYPE } from "../theme/tokens";

interface PillProps {
  tokens: ThemeTokens;
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function Pill({ tokens, label, active = false, onPress }: PillProps) {
  const t = tokens;
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: active ? t.ochre : t.surface3,
          borderColor: active ? t.ochre : t.line,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: active ? t.surface : t.inkDim },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: SPACING.m,
  },
  text: {
    fontSize: TYPE.small,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
