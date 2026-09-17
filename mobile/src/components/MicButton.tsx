import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { PhosphorIcon } from "./PhosphorIcon";
import { CircleNotch, Microphone } from "phosphor-react-native";
import { elevate } from "../theme/elevation";
import type { ThemeTokens } from "../theme/tokens";
import { EASE, MOTION } from "../theme/tokens";
import { hapticMicStart, hapticMicStop } from "../theme/haptics";

type MicState = "idle" | "recording" | "processing";

/** Public alias so screens can type their mic state without internals. */
export type MicButtonState = MicState;

interface MicButtonProps {
  tokens: ThemeTokens;
  state: MicState;
  disabled?: boolean;
  onPress: () => void;
}

const SIZE = 92;
const RING = 128;
const BAR_COUNT = 14;
const RING_RADIUS = (RING - 10) / 2;

/**
 * The primary CTA. Idle: soft outer glow + a barely-there breathing pulse that
 * invites a press. Recording: an amplitude ring takes over *around* the button
 * (never inside it) and the fill turns ember. Processing: a calm spinner.
 * Haptics fire on press/release. All motion is ease-based — no bounce anywhere.
 */
export function MicButton({ tokens: t, state, disabled = false, onPress }: MicButtonProps) {
  const recording = state === "recording";
  const processing = state === "processing";

  // Idle "breathing": ~2.5% scale over a slow ease-in-out loop.
  const breathe = useRef(new Animated.Value(1)).current;
  // Press feedback: 1.5% scale-down, ~90ms, no overshoot.
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === "idle" && !disabled) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1.025, duration: MOTION.breathe / 2, easing: EASE.inOut, useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 1, duration: MOTION.breathe / 2, easing: EASE.inOut, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    breathe.setValue(1);
    return undefined;
  }, [state, disabled, breathe]);

  const pressIn = () => {
    Animated.timing(press, { toValue: 0.985, duration: 90, easing: EASE.out, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.timing(press, { toValue: 1, duration: 120, easing: EASE.out, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    if (recording) hapticMicStop();
    else hapticMicStart();
    onPress();
  };

  const fill = recording ? t.rust : processing ? t.surface3 : t.ochre;
  const glyphColor = processing ? t.inkDim : t.surface;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* Amplitude ring — around the button, only while recording. */}
      {recording
        ? (
            <View style={styles.ring} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessible={false}>
              {Array.from({ length: BAR_COUNT }, (_, i) => (
                <RingBar key={i} index={i} color={t.rust} />
              ))}
            </View>
          )
        : null}

      {/* Idle glow (elevation token) — hidden while recording. */}
      {!recording && !processing ? (
        <View style={[styles.glow, elevate("float", t)]} pointerEvents="none" />
      ) : null}

      <Animated.View style={{ transform: [{ scale: breathe }] }}>
        <Animated.View style={{ transform: [{ scale: press }] }}>
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityState={{ busy: recording || processing, disabled }}
            accessibilityLabel={
              recording ? "Stop listening and translate" : processing ? "Translating" : "Start listening"
            }
            onPress={handlePress}
            onPressIn={pressIn}
            onPressOut={pressOut}
            disabled={disabled || processing}
            style={({ pressed }) => [
              styles.mic,
              { backgroundColor: fill, opacity: pressed && !processing ? 0.92 : 1 },
            ]}
          >
            {processing ? <Spinner color={glyphColor} /> : (
              <PhosphorIcon
                icon={Microphone}
                size={32}
                color={glyphColor}
                weight={recording ? "fill" : "duotone"}
              />
            )}
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** One amplitude bar around the ring; each runs its own ease loop with an
 * index-based duration so the ring shimmers rather than spins rigidly. */
function RingBar({ index, color }: { index: number; color: string }) {
  const v = useRef(new Animated.Value(0.45)).current;
  const angle = (360 / BAR_COUNT) * index;
  const duration = 420 + (index % 5) * 60;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: EASE.inOut, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration, easing: EASE.inOut, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [
            { rotate: `${angle}deg` },
            { translateY: -RING_RADIUS },
            { scaleY: v },
          ],
        },
      ]}
    />
  );
}

/** Calm processing spinner — slow, linear, no attention-grabbing pulse. */
function Spinner({ color }: { color: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return (
    <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      <PhosphorIcon icon={CircleNotch} size={30} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    position: "absolute",
    width: 4,
    height: 12,
    borderRadius: 2,
    left: RING / 2 - 2,
    top: RING / 2 - 6,
  },
  glow: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  mic: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
