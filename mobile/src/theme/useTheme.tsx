import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import { DARK, LIGHT, type ThemeTokens } from "./tokens";
import { useSettings, type ThemeMode } from "../store/settings";

type Resolved = "dark" | "light";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: Resolved;
  tokens: ThemeTokens;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useSettings((s) => s.themeMode);
  const setMode = useSettings((s) => s.setThemeMode);
  const system = useColorScheme() ?? "dark";

  const resolved: Resolved =
    themeMode === "dark" || themeMode === "light"
      ? themeMode
      : themeMode === "system"
        ? ((system as Resolved) ?? "dark")
        : "dark";

  const tokens = resolved === "light" ? LIGHT : DARK;

  const value = useMemo<ThemeContextValue>(
    () => ({ mode: themeMode, resolved, tokens, setMode }),
    [themeMode, resolved, tokens, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
