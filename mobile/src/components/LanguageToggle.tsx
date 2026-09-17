import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import type { ThemeTokens } from "../theme/tokens";
import { EASE, MOTION } from "../theme/tokens";
import { hapticSelection } from "../theme/haptics";
import { DIRECTIONS, directionLabel, type Direction } from "../types";

interface LanguageToggleProps {
  tokens: ThemeTokens;
  value: Direction;
  onChange: (d: Direction) => void;
}

/**
 * The V1 language-pair switcher, upgraded: one sliding gold pill behind the
 * two directions. The spring is tuned so damped it reads as "smooth" — plain
 * ease-out, high effective damping, zero visible overshoot.
 */
export function LanguageToggle({ tokens: t, value, onChange }: LanguageToggleProps) {
  const index = DIRECTIONS.indexOf(value);
  const slide = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: index, duration: MOTION.base, easing: EASE.out, useNativeDriver: true }).start();
  }, [index, slide]);

  return (
    <View
      accessible
      accessibilityRole="tablist"
      accessibilityLabel="Translation direction"
      style={[styles.track, { backgroundColor: t.cardIn }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            backgroundColor: t.ochre,
            left: slide.interpolate({ inputRange: [0, 1], outputRange: ["1.5%", "50%"] }),
          },
        ]}
      />
      {DIRECTIONS.map((d) => {
        const active = d === value;
        return (
          <Pressable
            key={d}
            accessible
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={directionLabel(d)}
            onPress={() => {
              if (!active) {
                hapticSelection();
                onChange(d);
              }
            }}
            style={({ pressed }) => [styles.segment, { opacity: pressed && !active ? 0.8 : 1 }]}
          >
            <Text
              numberOfLines={1}
              style={[styles.label, { color: active ? t.surface : t.inkDim }]}
            >
              {directionLabel(d)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 3,
    alignSelf: "center",
  },
  thumb: {
    position: "absolute",
    top: 3,
    bottom: 3,
    width: "47%",
    borderRadius: 999,
  },
  segment: {
    width: "50%",
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
