import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { RADII, SPACING, TRACKING, TYPE } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { PhosphorIcon } from "../components/PhosphorIcon";
import { TriangleDivider } from "../components/TriangleDivider";
import {
  Bell,
  GlobeHemisphereWest,
  Palette,
  Plugs,
  ShieldCheck,
  UserCircle,
} from "phosphor-react-native";
import { useSettings } from "../store/settings";
import {
  requestV3Notifications,
  notificationStatusLabel,
} from "../corrections/notifications";
import type { ThemeMode } from "../store/settings";
import { useAccount } from "../store/account";

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
  const user = useAccount((s) => s.user);
  const logout = useAccount((s) => s.logout);
  const authLoading = useAccount((s) => s.loading);
  const openAuthSheet = useAccount((s) => s.openAuthSheet);
  const lastSyncedAt = useAccount((s) => s.lastSyncedAt);
  const migration = useAccount((s) => s.migration);
  const authError = useAccount((s) => s.error);

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

        {/* --- Account (brief Section 7): additive, opt-in, never a gate. --- */}
        <Section title="Account" icon={UserCircle} tokens={t}>
          <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }]}>
            {user ? (
              <>
                <View style={styles.settingRow}>
                  <Text style={[styles.settingLabel, { color: t.ink }]} numberOfLines={1}>
                    {user.email}
                  </Text>
                  <Text style={[styles.staticTag, { color: t.teal }]}>Synced</Text>
                </View>
                <Text style={[styles.settingNote, { color: t.inkDim, marginBottom: 6 }]}>
                  {syncStatusText(lastSyncedAt, migration)}
                </Text>
                <Text style={[styles.settingNote, { color: t.inkDim }]}>
                  Your corrections and settings are backed up to your account so they follow you to
                  any device. Everything also stays on this phone and keeps working offline.
                </Text>
                <Pressable
                  onPress={() => {
                    Alert.alert(
                      "Log out",
                      "Your corrections and settings stay on this phone. You can log back in anytime to back them up again.",
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
                  <Text style={[styles.logoutText, { color: t.rust }]}>Log out</Text>
                </Pressable>
              </>
            ) : (
              <>
                {authError?.kind === "SESSION_EXPIRED" && (
                  <Text style={[styles.sessionNote, { color: t.teal, marginBottom: SPACING.s }]}>
                    {authError.message}
                  </Text>
                )}
                <Text style={[styles.settingNote, { color: t.inkDim, marginBottom: SPACING.s }]}>
                  Back up your Learn history and settings, and take them with you to any device.
                  The app works fully without an account.
                </Text>
                <View style={styles.pillRow}>
                  <Pressable
                    onPress={() => openAuthSheet("signup")}
                    style={[styles.pill, { backgroundColor: t.ochre }]}
                    accessibilityRole="button"
                    accessibilityLabel="Sign up"
                  >
                    <Text style={[styles.pillText, { color: t.surface }]}>Sign up</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openAuthSheet("login")}
                    style={[styles.pill, { borderWidth: 1.5, borderColor: t.ochre }]}
                    accessibilityRole="button"
                    accessibilityLabel="Log in"
                  >
                    <Text style={[styles.pillText, { color: t.ochre }]}>Log in</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Section>

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
  pillRow: {
    flexDirection: "row",
    gap: SPACING.s,
  },
  sessionNote: {
    fontSize: TYPE.small,
    lineHeight: 18,
    fontWeight: "600",
  },
  pill: {
    flex: 1,
    borderRadius: RADII.pill,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: TYPE.body,
    fontWeight: "800",
  },
});

/** Human copy for the "Last backed up …" line (brief Section 7). */
function syncStatusText(lastSyncedAt: string | null, migration: string): string {
  if (migration === "uploading") return "Backing up your history…";
  if (migration === "failed") return "Last backup didn't finish — we'll retry automatically.";
  if (!lastSyncedAt) return "Backup will start shortly.";
  const mins = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 60_000);
  if (mins < 1) return "Last backed up just now";
  if (mins < 60) return `Last backed up ${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last backed up ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Last backed up ${days} day${days === 1 ? "" : "s"} ago`;
}
