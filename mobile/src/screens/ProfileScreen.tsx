import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { RADII, SPACING, TRACKING, TYPE } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { PhosphorIcon } from "../components/PhosphorIcon";
import { TriangleDivider } from "../components/TriangleDivider";
import {
  ArrowLeft,
  Bell,
  GlobeHemisphereWest,
  Palette,
  Plugs,
  ShieldCheck,
} from "phosphor-react-native";
import { useSettings } from "../store/settings";
import {
  requestV3Notifications,
  notificationStatusLabel,
} from "../corrections/notifications";
import type { ThemeMode } from "../store/settings";
import { useAuth } from "../store/auth";

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
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const authLoading = useAuth((s) => s.loading);

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

        <Section title="Appearance" icon={Palette} tokens={t}>
          <View
            style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }]}
          >
            <View style={styles.radioGroup}>
              {MODES.map((m) => {
                const active = mode === m.value;
                return (
                  <Pressable
                    key={m.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={`${m.label} theme`}
                    onPress={() => setMode(m.value)}
                    style={({ pressed }) => [
                      styles.radioItem,
                      {
                        backgroundColor: active ? t.mossSoft : "transparent",
                        borderColor: active ? t.moss : t.line,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.radioDot,
                        {
                          borderColor: active ? t.moss : t.inkDim,
                          backgroundColor: active ? t.moss : "transparent",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.radioLabel,
                        { color: active ? t.ink : t.inkDim },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        <Section title="Language pair" icon={GlobeHemisphereWest} tokens={t}>
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

        <Section title="Notifications" icon={Bell} tokens={t}>
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

        <Section title="Server" icon={Plugs} tokens={t}>
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

        <Section title="Privacy" icon={ShieldCheck} tokens={t}>
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

        {user && (
          <Section title="Account" icon={ArrowLeft} tokens={t}>
            <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }]}>
              {user.fullName && (
                <View style={styles.settingRow}>
                  <Text style={[styles.settingLabel, { color: t.ink }]}>{user.fullName}</Text>
                </View>
              )}
              {user.email && (
                <View style={styles.settingRow}>
                  <Text style={[styles.settingNote, { color: t.inkDim }]}>{user.email}</Text>
                </View>
              )}
              {user.country && (
                <View style={styles.settingRow}>
                  <Text style={[styles.settingNote, { color: t.inkDim }]}>{user.country}</Text>
                </View>
              )}
              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Log out",
                    "Are you sure you want to log out?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Log out",
                        style: "destructive",
                        onPress: () => void logout(),
                      },
                    ],
                  );
                }}
                disabled={authLoading}
                style={[styles.logoutButton, { backgroundColor: t.rustSoft, borderColor: t.rust }]}
              >
                <PhosphorIcon icon={ArrowLeft} size={16} color={t.rust} weight="bold" />
                <Text style={[styles.logoutText, { color: t.rust }]}>Log out</Text>
              </Pressable>
            </View>
          </Section>
        )}

        <Text style={[styles.version, { color: t.inkDim }]}>VUGA v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  icon: SectionIcon,
  tokens,
  children,
}: {
  title: string;
  icon: typeof Palette;
  tokens: ReturnType<typeof useTheme>["tokens"];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <PhosphorIcon icon={SectionIcon} size={13} color={tokens.ochre} />
        <Text style={[styles.sectionTitle, { color: tokens.inkDim }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: SPACING.m, paddingBottom: SPACING.xl },
  title: { fontSize: TYPE.title, fontWeight: "800", marginBottom: SPACING.xs },
  section: { marginTop: SPACING.l },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: SPACING.s,
  },
  sectionTitle: {
    fontSize: TYPE.tiny,
    fontWeight: "700",
    letterSpacing: TRACKING.wide,
  },
  card: {
    borderRadius: RADII.card,
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
  radioGroup: {
    flexDirection: "row",
    gap: 8,
  },
  radioItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  radioDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  radioLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  settingLabel: { fontSize: TYPE.body },
  settingNote: { fontSize: TYPE.small, lineHeight: 18 },
  staticTag: { fontSize: TYPE.tiny, fontWeight: "800", letterSpacing: TRACKING.wide },
  input: {
    borderRadius: RADII.card,
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
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.s,
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    marginTop: SPACING.s,
  },
  logoutText: {
    fontSize: TYPE.body,
    fontWeight: "700",
  },
  version: {
    textAlign: "center",
    marginTop: SPACING.xl,
    fontSize: TYPE.tiny,
  },
});
