import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { SPACING, TYPE } from "../theme/tokens";
import { TriangleDivider } from "../components/TriangleDivider";
import { useSettings } from "../store/settings";
import {
  requestV3Notifications,
  notificationStatusLabel,
} from "../corrections/notifications";
import type { ThemeMode } from "../store/settings";

const MODES: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

export function ProfileScreen() {
  const { tokens: t, mode, setMode } = useTheme();
  const proxyUrl = useSettings((s) => s.proxyUrl);
  const setProxyUrl = useSettings((s) => s.setProxyUrl);
  const notificationsOn = useSettings((s) => s.notificationsOn);
  const setNotificationsOn = useSettings((s) => s.setNotificationsOn);

  // V3: OS permission status, so the toggle's caption is never ambiguous.
  const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "unavailable" | "unset">("unset");
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const Notifications = await import("expo-notifications");
        const current = await Notifications.getPermissionsAsync();
        if (alive) setNotifStatus(current.granted ? "granted" : current.canAskAgain ? "denied" : "unavailable");
      } catch {
        if (alive) setNotifStatus("unavailable");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onNotificationsToggle = (on: boolean) => {
    setNotificationsOn(on);
    if (on) {
      // Explain-then-ask: the plain-language note below explains why before the
      // OS prompt appears; the toggle caption reflects the outcome.
      void requestV3Notifications().then((status) => setNotifStatus(status));
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.surface }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: t.ink }]}>Profile</Text>
        <TriangleDivider colors={[t.ochre, t.rust, t.moss]} />

        <Section title="Appearance" tokens={t}>
          <View
            style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }]}
          >
            {MODES.map((m) => (
              <View key={m.value} style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: t.ink }]}>{m.label}</Text>
                <Switch
                  value={mode === m.value}
                  onValueChange={(on) => {
                    if (on) setMode(m.value);
                  }}
                  trackColor={{ true: t.moss, false: t.surface3 }}
                  thumbColor={t.ink}
                  accessibilityLabel={`${m.label} theme`}
                  accessibilityState={{ checked: mode === m.value }}
                />
              </View>
            ))}
          </View>
        </Section>

        <Section title="Language pair" tokens={t}>
          <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }]}>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: t.ink }]}>
                Kinyarwanda ⇄ Mandarin
              </Text>
              <Text style={[styles.staticTag, { color: t.inkDim }]}>V1</Text>
            </View>
            <Text style={[styles.settingNote, { color: t.inkDim }]}>
              VUGA currently supports one language pair. More languages are planned for a future
              version.
            </Text>
          </View>
        </Section>

        <Section title="Notifications" tokens={t}>
          <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }]}>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: t.ink }]}>Coaching reminders</Text>
              <Switch
                value={notificationsOn !== false}
                onValueChange={onNotificationsToggle}
                trackColor={{ true: t.moss, false: t.surface3 }}
                thumbColor={t.ink}
                accessibilityLabel="Coaching reminders"
                accessibilityState={{ checked: notificationsOn !== false }}
              />
            </View>
            <Text style={[styles.settingNote, { color: t.inkDim, marginBottom: 6 }]}>
              {notificationStatusLabel(notifStatus)}
            </Text>
            <Text style={[styles.settingNote, { color: t.inkDim }]}>
              What these are: occasionally VUGA sends a quiet, on-device reminder when a mistake you
              kept shows up again, or when your progress level in a topic rises. That's all it sends
              — no messages from anyone else, nothing marketed to you.
            </Text>
            <Text style={[styles.settingNote, { color: t.inkDim }]}>
              Where they come from: reminders are built on this device from your own kept
              corrections. Nothing about them touches our servers, and turning them off here stops
              them completely.
            </Text>
          </View>
        </Section>

        <Section title="Server" tokens={t}>
          <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }]}>
            <Text style={[styles.settingNote, { color: t.inkDim, marginBottom: 6 }]}>
              Address of the VUGA translation proxy (advanced).
            </Text>
            <TextInput
              value={proxyUrl}
              onChangeText={setProxyUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel="Proxy server address"
              style={[
                styles.input,
                { backgroundColor: t.surface3, borderColor: t.line, color: t.ink },
              ]}
            />
          </View>
        </Section>

        <Section title="Privacy" tokens={t}>
          <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }]}>
            <Text style={[styles.privacyText, { color: t.ink }]}>
              What happens to your voice: when you press the mic, your speech is sent to the VUGA
              translation proxy, which forwards it to a third-party speech service (Google) to be
              transcribed and translated. That's how translation works — there is no offline
              option in this version.
            </Text>
            <Text style={[styles.privacyText, { color: t.ink }]}>
              Nothing is stored on our servers: the proxy forwards requests and forgets them. Your
              kept corrections and settings live only on this device, and you can delete them from
              the Learn tab at any time.
            </Text>
          </View>
        </Section>

        <Text style={[styles.version, { color: t.inkDim }]}>VUGA v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  tokens,
  children,
}: {
  title: string;
  tokens: ReturnType<typeof useTheme>["tokens"];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: tokens.inkDim }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: SPACING.m, paddingBottom: SPACING.xl },
  title: { fontSize: TYPE.title, fontWeight: "800", marginBottom: SPACING.xs },
  section: { marginTop: SPACING.l },
  sectionTitle: {
    fontSize: TYPE.tiny,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: SPACING.s,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  settingLabel: { fontSize: TYPE.body },
  settingNote: { fontSize: TYPE.small, lineHeight: 18 },
  staticTag: { fontSize: TYPE.tiny, fontWeight: "800", letterSpacing: 1 },
  input: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.s,
    paddingVertical: 8,
    fontSize: TYPE.small,
  },
  privacyText: {
    fontSize: TYPE.small,
    lineHeight: 19,
    marginBottom: SPACING.s,
  },
  version: {
    textAlign: "center",
    marginTop: SPACING.xl,
    fontSize: TYPE.tiny,
  },
});
