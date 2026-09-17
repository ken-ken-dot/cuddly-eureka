import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme";
import { DARK } from "../theme/tokens";
import { Logo } from "./Logo";
import { useAuth } from "../store/auth";
import { SignupScreen } from "../screens/SignupScreen";
import { LoginScreen } from "../screens/LoginScreen";

type AuthView = "signup" | "login";

/**
 * Wraps the app's authenticated content. On mount:
 * 1. Shows a branded splash while restoring the session from secure storage.
 * 2. If a valid session exists → renders children (the main app).
 * 3. If no session → shows signup/login screens.
 *
 * The splash prevents a flash of the login screen for returning users.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { tokens: t } = useTheme();
  const { user, restoring, initialized, initialize } = useAuth();
  const [authView, setAuthView] = useState<AuthView>("signup");

  useEffect(() => {
    if (!initialized) {
      initialize();
    }

    // Safety net: if initialize() hangs (e.g. bad network + misconfigured
    // Supabase), force the app through after 5 s so it's never stuck.
    const timer = setTimeout(() => {
      const state = useAuth.getState();
      if (!state.initialized) {
        state.initialize();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [initialized, initialize]);

  // Still restoring session — show branded splash.
  if (!initialized || restoring) {
    return (
      <View style={[styles.splash, { backgroundColor: DARK.surface }]}>
        <Logo size={44} ochre={DARK.ochre} rust={DARK.rust} />
        <Text style={[styles.splashText, { color: DARK.inkDim }]}>VUGA</Text>
      </View>
    );
  }

  // No authenticated user — show auth screens.
  if (!user) {
    return authView === "signup" ? (
      <SignupScreen onSwitchToLogin={() => setAuthView("login")} />
    ) : (
      <LoginScreen onSwitchToSignup={() => setAuthView("signup")} />
    );
  }

  // Authenticated — render the main app.
  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  splashText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 4,
  },
});
