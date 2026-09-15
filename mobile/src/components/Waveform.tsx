import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

interface WaveformProps {
  active: boolean;
  color: string;
  barCount?: number;
}

/** Pulsing bars shown while the mic is live. */
export function Waveform({ active, color, barCount = 7 }: WaveformProps) {
  const values = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.35)),
  ).current;

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [];
    values.forEach((v, i) => {
      if (active) {
        animations.push(
          Animated.loop(
            Animated.sequence([
              Animated.timing(v, {
                toValue: 1,
                duration: 380 + i * 55,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(v, {
                toValue: 0.35,
                duration: 380 + i * 55,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            { key: `w${i}` } as never,
          ),
        );
      }
    });
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [active, values]);

  return (
    <View
      importantForAccessibility={active ? "no" : "no-hide-descendants"}
      style={styles.row}
      accessible={false}
    >
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              opacity: active ? 1 : 0.3,
              transform: [{ scaleY: active ? v : 0.35 }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 26,
  },
  bar: {
    width: 5,
    height: 26,
    borderRadius: 3,
  },
});
