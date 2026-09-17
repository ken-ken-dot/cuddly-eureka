import { Easing } from "react-native";

export interface ThemeTokens {
  surface: string;
  surface2: string;
  surface3: string;
  ink: string;
  inkDim: string;
  rust: string;
  rustSoft: string;
  ochre: string;
  moss: string;
  mossSoft: string;
  teal: string;
  tealSoft: string;
  line: string;
  /** Card fill lifted one step above `surface` — layered-surface look. */
  card: string;
  /** Solid overlay for in-card recessed surfaces (ticket stubs). */
  cardIn: string;
}

export const DARK: ThemeTokens = {
  surface: "#1C1815",
  surface2: "#252019",
  surface3: "#2E2721",
  ink: "#F1E9DA",
  inkDim: "#C9BFAE",
  rust: "#C4552F",
  rustSoft: "#3A241C",
  ochre: "#E0A458",
  moss: "#63A98F",
  mossSoft: "#233B33",
  teal: "#5FB8C4",
  tealSoft: "#1F3A3E",
  line: "rgba(241,233,218,0.14)",
  card: "#252019",
  cardIn: "#2E2721",
} as const;

export const LIGHT: ThemeTokens = {
  surface: "#F6F7F5",
  surface2: "#EDEEEA",
  surface3: "#E2E4DE",
  ink: "#1C1815",
  inkDim: "#5C564C",
  rust: "#A93E22",
  rustSoft: "#F4DDD4",
  ochre: "#B9822E",
  moss: "#2E6B52",
  mossSoft: "#D8E8E0",
  teal: "#22707C",
  tealSoft: "#D6EAED",
  line: "rgba(28,24,21,0.12)",
  card: "#FFFFFF",
  cardIn: "#EDEEEA",
} as const;

/** 4/8px spacing grid. */
export const SPACING = { xs: 4, s: 8, m: 16, l: 24, xl: 32 } as const;

/** Two corner radii, max: cards/inputs 12, pills/buttons 24+ (999 = full pill). */
export const RADII = { card: 12, button: 24, pill: 999 } as const;

/**
 * Elevation tokens — soft, low-opacity shadows so cards feel layered, not flat.
 * Applied via the shared `elevate` helper (iOS shadow + Android elevation).
 */
export const ELEVATION = {
  /** Resting cards: tickets, transcript cards, setting cards. */
  card: { y: 2, blur: 8, opacity: 0.28, android: 2 },
  /** Floating controls: the mic button and its glow ring. */
  float: { y: 6, blur: 18, opacity: 0.38, android: 8 },
} as const;

/**
 * Motion system — premium, never playful: ease-out entrances, ease-in exits,
 * no bounce, no overshoot anywhere. Durations in ms.
 */
export const MOTION = {
  fast: 150,
  base: 220,
  slow: 280,
  /** Mic idle "breathing" loop period. */
  breathe: 3400,
} as const;

/** Shared easings so every screen animates identically. */
export const EASE = {
  out: Easing.out(Easing.quad),
  in: Easing.in(Easing.quad),
  inOut: Easing.inOut(Easing.quad),
} as const;

/**
 * Type scale — display / title / h2 / body / small / caption.
 * `zh` sizes are tuned so Mandarin glyphs read at matched visual weight next
 * to Latin text (CJK runs visually smaller at equal pt).
 */
export const TYPE = {
  display: 32,
  title: 28,
  h2: 20,
  body: 16,
  zh: 19,
  small: 13,
  tiny: 11,
} as const;

/** Shared letter-spacing for small all-caps labels. */
export const TRACKING = { wide: 1, wider: 1.5 } as const;
