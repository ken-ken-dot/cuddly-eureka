import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

import { ThemeProvider } from "./src/theme";
import { RootTabs } from "./src/navigation/RootTabs";
import { useSettings } from "./src/store/settings";
import { useCorrections } from "./src/store/corrections";
import { useTracking } from "./src/corrections/tracking";
import { useBackgroundSync } from "./src/store/backgroundSync";
import { Logo } from "./src/components/Logo";
import { DARK } from "./src/theme/tokens";
import { AuthSheets } from "./src/components/AuthSheets";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { useAccount } from "./src/store/account";

function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrateSettings = useSettings((s) => s.hydrate);
  const hydrateCorrections = useCorrections((s) => s.hydrate);
  const hydrateTracking = useTracking((s) => s.hydrate);
  // Restore any stored account session (silent, best-effort). The app renders
  // whether or not a session exists — auth is additive, not a gate (brief §0).
  const restoreAccount = useAccount((s) => s.restore);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all([
        hydrateSettings(),
        hydrateCorrections(),
        hydrateTracking(),
        restoreAccount(),
      ]);
      if (alive) setReady(true);
      // V3: snapshot proficiency at session start so "level cleared" has a
      // baseline to compare against.
      useTracking.getState().beginSession();
    })();
    return () => {
      alive = false;
    };
  }, [hydrateSettings, hydrateCorrections, hydrateTracking, restoreAccount]);

  if (!ready) {
    return (
      <View style={[styles.splash, { backgroundColor: DARK.surface }]}>
        <Logo size={44} ochre={DARK.ochre} rust={DARK.rust} />
        <Text style={[styles.splashText, { color: DARK.inkDim }]}>VUGA</Text>
      </View>
    );
  }
  return <>{children}</>;
}

export default function App() {
  // Signed-in users get background correction sync (brief §7). Signed out,
  // the hook is a no-op and every flow is byte-for-byte as before.
  useBackgroundSync();

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ErrorBoundary>
        <HydrationGate>
          <ThemeProvider>
            <RootTabs />
            <AuthSheets />
          </ThemeProvider>
        </HydrationGate>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  splashText: { fontSize: 16, fontWeight: "800", letterSpacing: 4 },
});
