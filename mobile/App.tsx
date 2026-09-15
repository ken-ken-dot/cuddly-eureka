import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ThemeProvider } from "./src/theme";
import { RootTabs } from "./src/navigation/RootTabs";
import { useSettings } from "./src/store/settings";
import { useCorrections } from "./src/store/corrections";
import { useTracking } from "./src/corrections/tracking";
import { Logo } from "./src/components/Logo";
import { DARK } from "./src/theme/tokens";

function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrateSettings = useSettings((s) => s.hydrate);
  const hydrateCorrections = useCorrections((s) => s.hydrate);
  const hydrateTracking = useTracking((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all([hydrateSettings(), hydrateCorrections(), hydrateTracking()]);
      if (alive) setReady(true);
      // V3: snapshot proficiency at session start so "level cleared" has a
      // baseline to compare against.
      useTracking.getState().beginSession();
    })();
    return () => {
      alive = false;
    };
  }, [hydrateSettings, hydrateCorrections, hydrateTracking]);

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
  return (
    <HydrationGate>
      <ThemeProvider>
        <RootTabs />
      </ThemeProvider>
    </HydrationGate>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  splashText: { fontSize: 16, fontWeight: "800", letterSpacing: 4 },
});
