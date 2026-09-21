import React, { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import { useTheme } from "../theme";
import type { ThemeTokens } from "../theme/tokens";

/**
 * Scattered, low-opacity language/communication glyphs behind the auth forms.
 *
 * Design rules (per brief):
 *  - inline vector paths (react-native-svg), zero external image requests
 *  - non-interactive: pointerEvents="none" so taps always fall through
 *  - absolute-filled layer rendered BEFORE the card in the tree, so it can
 *    never intercept or shift layout
 *  - very slow drift/float (14–22s loops), no flashing, no pulsing opacity
 *  - disabled entirely when the OS reports reduce-motion is on
 *
 * Glyph set: speech bubbles, chat bubbles, globe (meridians), sound waves,
 * and a translation "A/文" style swap — all drawn from primitives only.
 */

/** Deterministic pseudo-random layout — identical every mount (no jank, no
 *  hydration-style flicker), spread by hand across the full screen. */
const GLYPHS: ReadonlyArray<{
  icon: "bubble" | "chat" | "globe" | "waves" | "swap";
  x: number; // 0..1 of width
  y: number; // 0..1 of height
  size: number;
  opacity: number;
  drift: number; // px of vertical float
  duration: number; // ms per float cycle
}> = [
  { icon: "bubble", x: 0.08, y: 0.07, size: 34, opacity: 0.1, drift: 9, duration: 17000 },
  { icon: "globe", x: 0.82, y: 0.05, size: 40, opacity: 0.09, drift: 7, duration: 21000 },
  { icon: "waves", x: 0.16, y: 0.24, size: 26, opacity: 0.1, drift: 11, duration: 15000 },
  { icon: "chat", x: 0.88, y: 0.3, size: 30, opacity: 0.08, drift: 8, duration: 19000 },
  { icon: "swap", x: 0.06, y: 0.55, size: 32, opacity: 0.09, drift: 10, duration: 16500 },
  { icon: "bubble", x: 0.9, y: 0.62, size: 24, opacity: 0.1, drift: 9, duration: 14500 },
  { icon: "globe", x: 0.12, y: 0.8, size: 30, opacity: 0.08, drift: 8, duration: 20000 },
  { icon: "chat", x: 0.85, y: 0.87, size: 34, opacity: 0.09, drift: 10, duration: 18000 },
  { icon: "waves", x: 0.5, y: 0.95, size: 24, opacity: 0.07, drift: 7, duration: 16000 },
  { icon: "swap", x: 0.55, y: 0.02, size: 26, opacity: 0.08, drift: 8, duration: 15500 },
];

function GlyphSvg({
  kind,
  size,
  color,
}: {
  kind: (typeof GLYPHS)[number]["icon"];
  size: number;
  color: string;
}) {
  const stroke = { stroke: color, strokeWidth: 1.6, fill: "none" as const, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "bubble": // rounded speech bubble with tail
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9l-4.5 3.5v-3.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5Z" {...stroke} />
          <Path d="M7.5 10.5h9M7.5 13.5h5.5" {...stroke} />
        </Svg>
      );
    case "chat": // two overlapping chat bubbles
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H8L4.5 16v-2.5H3A1.5 1.5 0 0 1 1.5 12V6A1.5 1.5 0 0 1 3 4.5Z" {...stroke} />
          <Path d="M18.5 9.5H21A1.5 1.5 0 0 1 22.5 11v5a1.5 1.5 0 0 1-1.5 1.5h-1v2.5L16.5 17.5H11" {...stroke} />
        </Svg>
      );
    case "globe": // circle + meridians
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="9" {...stroke} />
          <Path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" {...stroke} />
        </Svg>
      );
    case "waves": // sound waves: dot + three arcs
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="5" cy="12" r="1.4" fill={color} />
          <Path d="M9.5 8.5a5.5 5.5 0 0 1 0 7M13.5 5.5a9.5 9.5 0 0 1 0 13M17.5 3a13.5 13.5 0 0 1 0 18" {...stroke} />
        </Svg>
      );
    case "swap": // translation swap: two arrows in a loop (A ⇄ 文 idea)
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 8.5h13l-3-3M20 15.5H7l3 3" {...stroke} />
          <Rect x="2.5" y="6.8" width="3.4" height="3.4" rx="0.8" {...stroke} />
          <Rect x="18.1" y="13.8" width="3.4" height="3.4" rx="0.8" {...stroke} />
        </Svg>
      );
  }
}

/**
 * Full-screen absolutely-positioned decoration layer. Place as the FIRST child
 * of the screen's root; siblings after it naturally stack above it.
 */
export function AuthBackgroundIcons() {
  const { tokens: t, resolved } = useTheme();

  // Icons tint from the dim ink token so they read as texture in both themes
  // without ever competing with form content.
  const color = resolved === "light" ? t.inkDim : t.inkDim;

  const items = useMemo(
    () =>
      GLYPHS.map((g, i) => ({ ...g, key: `bg-${i}`, color })),
    [color],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} aria-hidden>
      {items.map((g) => (
        <FloatingGlyph key={g.key} glyph={g} />
      ))}
    </View>
  );
}

/** One glyph with its own slow float loop. Animation starts only after the
 *  reduce-motion check resolves; if reduce-motion is on, the glyph is static. */
function FloatingGlyph({
  glyph,
}: {
  glyph: (typeof GLYPHS)[number] & { key: string; color: string };
}) {
  const reduceMotionRef = useRef(false);
  const anim = useRef(new Animated.Value(0)).current;
  const startedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (!alive) return;
        reduceMotionRef.current = v;
        if (!v && !startedRef.current) {
          startedRef.current = true;
          // Negative-ish start via delay stagger isn't needed; loop starts at 0.
          Animated.loop(
            Animated.sequence([
              Animated.timing(anim, {
                toValue: 1,
                duration: glyph.duration,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(anim, {
                toValue: 0,
                duration: glyph.duration,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ).start();
        }
      })
      .catch(() => {
        // If the check fails, stay static — never animate blindly.
      });
    return () => {
      alive = false;
      anim.stopAnimation();
    };
  }, [anim, glyph.duration]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -glyph.drift],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: `${glyph.x * 100}%`,
        top: `${glyph.y * 100}%`,
        opacity: glyph.opacity,
        transform: [{ translateY }],
      }}
    >
      <GlyphSvg kind={glyph.icon} size={glyph.size} color={glyph.color} />
    </Animated.View>
  );
}
