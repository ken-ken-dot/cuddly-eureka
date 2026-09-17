import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme";
import { RADII, SPACING, TYPE } from "../theme/tokens";

interface GoogleButtonProps {
  onPress: () => void;
}

/**
 * "Continue with Google" placeholder button.
 * Uses Google's official G brand asset (inline SVG-like View).
 * Styled as a secondary/low-emphasis action — outlined, not gold.
 *
 * TODO: Wire to real Google OAuth when the provider is set up.
 */
export function GoogleButton({ onPress }: GoogleButtonProps) {
  const { tokens: t } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: "transparent",
          borderColor: t.line,
        },
      ]}
    >
      {/* Google "G" logo — simplified vector representation */}
      <View style={styles.logoWrap}>
        <View style={[styles.gCircle, { backgroundColor: "#fff" }]}>
          <View style={styles.gInner}>
            <Text style={styles.gText}>G</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.label, { color: t.ink }]}>Continue with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.button,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 13,
    gap: SPACING.s,
  },
  logoWrap: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  gCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  gInner: {},
  gText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4285F4",
    lineHeight: 18,
  },
  label: {
    fontSize: TYPE.body,
    fontWeight: "600",
  },
});
