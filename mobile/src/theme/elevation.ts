import type { ViewStyle } from "react-native";

import type { ThemeTokens } from "./tokens";
import { ELEVATION } from "./tokens";

type Level = keyof typeof ELEVATION;

/**
 * Apply a named elevation level to any style object. Shadow color follows the
 * theme's surface darkness so depth stays subtle on both dark and light mode.
 */
export function elevate(level: Level, t: ThemeTokens): ViewStyle {
  const e = ELEVATION[level];
  return {
    shadowColor: t.card === t.surface ? "#000000" : "#1C1815",
    shadowOpacity: e.opacity,
    shadowRadius: e.blur,
    shadowOffset: { width: 0, height: e.y },
    elevation: e.android,
  };
}
