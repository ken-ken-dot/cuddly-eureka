import React, { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { RADII, SPACING, TYPE } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { Ticket } from "../components/Ticket";
import { TriangleDivider } from "../components/TriangleDivider";
import { EmptyState } from "../components/EmptyState";
import { TopicBreakdown } from "../components/TopicBreakdown";
import { useCorrections } from "../store/corrections";
import { useTracking } from "../corrections/tracking";

import { Ticket as TicketIcon, X, GraduationCap } from "phosphor-react-native";
import { PhosphorIcon } from "../components/PhosphorIcon";
import { WeakPointsCard } from "../components/WeakPointsCard";
import { WeeklyTrendCard } from "../components/WeeklyTrendCard";
import { PracticeModal } from "./PracticeModal";
import { useAccount } from "../store/account";

export function LearnScreen() {
  const { tokens: t } = useTheme();
  const corrections = useCorrections((s) => s.corrections);
  const remove = useCorrections((s) => s.remove);
  const report = useTracking((s) => s.report);
  const recompute = useTracking((s) => s.recompute);
  // Learning brief §6: weak points + weekly trend expand this screen's progress
  // card; Practice is an opt-in session entered from here (never a new tab).
  const [practiceOpen, setPracticeOpen] = React.useState(false);
  const user = useAccount((s) => s.user);
  const openAuthSheet = useAccount((s) => s.openAuthSheet);

  // V3: keep the proficiency report fresh as kept corrections change. The
  // existing V1 list below is untouched.
  useEffect(() => {
    recompute();
  }, [recompute, corrections]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.surface }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.ink }]}>Learn</Text>
        <Text style={[styles.subtitle, { color: t.inkDim }]}>
          Corrections you kept — your personal phrasebook of fixes.
        </Text>
        <TriangleDivider colors={[t.ochre, t.rust, t.moss]} />
        {/* V3: per-topic progress breakdown — same card style, more rows. */}
        <View style={styles.progress}>
          <Text style={[styles.progressLabel, { color: t.inkDim }]}>PROGRESS</Text>
          {report ? <TopicBreakdown report={report} tokens={t} /> : null}
          {/* Learning brief §2/§6: ranked weak points — works signed-out too. */}
          <WeakPointsCard corrections={corrections} tokens={t} />
          {/* Learning brief §2/§6: progress over time, honest about sparse data. */}
          <WeeklyTrendCard corrections={corrections} tokens={t} />
          {/* Practice entry point (§6): a session you enter, not a destination. */}
          <Pressable
            onPress={() => (user ? setPracticeOpen(true) : openAuthSheet("signup"))}
            style={[styles.practiceCard, { backgroundColor: t.mossSoft, borderColor: t.moss }, elevate("card", t)]}
            accessibilityRole="button"
            accessibilityLabel={
              user
                ? "Start a practice session with the corrections you kept"
                : "Sign in to save your progress and get proper practice"
            }
          >
            <PhosphorIcon icon={GraduationCap} size={20} color={t.moss} weight="fill" />
            <View style={styles.practiceTextWrap}>
              <Text style={[styles.practiceTitle, { color: t.ink }]}>Practice</Text>
              <Text style={[styles.practiceSubtitle, { color: t.inkDim }]}>
                {user
                  ? "A quick drill from the mistakes you kept."
                  : "Sign in to save your progress and get proper practice."}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={corrections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <EmptyState
              tokens={t}
              icon={TicketIcon}
              title="No corrections kept yet"
              body="When VUGA hears a word worth fixing on the Translate tab, it shows a ticket. Keep the ones you want to practice and they'll live here."
            />
            <View style={[styles.note, { backgroundColor: t.surface2, borderColor: t.line }, elevate("card", t)]}>
              <Text style={[styles.noteText, { color: t.inkDim }]}>
                A note on coverage: corrections come from a small, curated list of common
                market-vendor mistakes — not a full grammar engine. A missing ticket doesn't mean
                your Kinyarwanda was perfect; it means that mistake isn't in the list yet.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.ticketWrap}>
              <Ticket
                tokens={t}
                wrong={item.wrong}
                right={item.right}
                tip={item.tip}
                kept
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove correction: say ${item.right} instead of ${item.wrong}`}
              onPress={() => remove(item.id)}
              hitSlop={10}
              style={[styles.remove, { backgroundColor: t.surface2, borderColor: t.line }]}
            >
              <PhosphorIcon icon={X} size={14} color={t.inkDim} weight="bold" />
            </Pressable>
          </View>
        )}
      />
      {/* Practice drill flow — a modal session, not a tab (learning brief §6). */}
      <PracticeModal visible={practiceOpen} onClose={() => setPracticeOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: SPACING.m, paddingTop: SPACING.s, gap: 4 },
  progress: { marginTop: SPACING.s, gap: 6 },
  practiceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.s,
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  practiceTextWrap: { flex: 1, gap: 2 },
  practiceTitle: { fontSize: TYPE.body, fontWeight: "800" },
  practiceSubtitle: { fontSize: TYPE.small, lineHeight: 17 },
  progressLabel: { fontSize: TYPE.tiny, fontWeight: "700", letterSpacing: 1 },
  title: { fontSize: TYPE.title, fontWeight: "800" },
  subtitle: { fontSize: TYPE.small, lineHeight: 18, marginBottom: SPACING.xs },
  list: { padding: SPACING.m },
  empty: { alignItems: "center", gap: SPACING.m, paddingTop: SPACING.xl },
  note: {
    alignSelf: "stretch",
    marginTop: SPACING.s,
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.m,
  },
  noteText: { fontSize: TYPE.small, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.m,
    gap: SPACING.s,
  },
  ticketWrap: { flex: 1 },
  remove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

});
