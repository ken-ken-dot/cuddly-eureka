import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PhosphorIcon } from "./PhosphorIcon";
import { Warning, X } from "phosphor-react-native";
import type { ThemeTokens } from "../theme/tokens";
import { RADII, SPACING, TYPE } from "../theme/tokens";

interface ErrorBarProps {
  tokens: ThemeTokens;
  message: string;
  onDismiss?: () => void;
}

export function ErrorBar({ tokens, message, onDismiss }: ErrorBarProps) {
  const t = tokens;
  return (
    <View
      accessibilityLiveRegion="polite"
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`Error: ${message}`}
      style={[styles.bar, { backgroundColor: t.rustSoft, borderColor: t.rust }]}
    >
      <PhosphorIcon icon={Warning} size={16} color={t.rust} />
      <Text style={[styles.text, { color: t.ink }]}>{message}</Text>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
          onPress={onDismiss}
          hitSlop={12}
          style={styles.close}
        >
          <PhosphorIcon icon={X} size={14} color={t.inkDim} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADII.button,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    gap: SPACING.s,
  },
  text: {
    flex: 1,
    fontSize: TYPE.small,
    lineHeight: 18,
  },
  close: {
    padding: 2,
  },
});
