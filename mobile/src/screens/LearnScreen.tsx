import React, { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { SPACING, TYPE } from "../theme/tokens";
import { Ticket } from "../components/Ticket";
import { TriangleDivider } from "../components/TriangleDivider";
import { TopicBreakdown } from "../components/TopicBreakdown";
import { useCorrections } from "../store/corrections";
import { useTracking } from "../corrections/tracking";

export function LearnScreen() {
  const { tokens: t } = useTheme();
  const corrections = useCorrections((s) => s.corrections);
  const remove = useCorrections((s) => s.remove);
  const report = useTracking((s) => s.report);
  const recompute = useTracking((s) => s.recompute);

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
        </View>
      </View>

      <FlatList
        data={corrections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: t.ink }]}>No corrections kept yet</Text>
            <Text style={[styles.emptyBody, { color: t.inkDim }]}>
              When VUGA hears a word worth fixing on the Translate tab, it shows a ticket. Keep the
              ones you want to practice and they'll live here.
            </Text>
            <View style={styles.note}>
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
              style={[styles.remove, { borderColor: t.line }]}
            >
              <Text style={[styles.removeText, { color: t.inkDim }]}>✕</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: SPACING.m, paddingTop: SPACING.s, gap: 4 },
  progress: { marginTop: SPACING.s, gap: 6 },
  progressLabel: { fontSize: TYPE.tiny, fontWeight: "700", letterSpacing: 1 },
  title: { fontSize: TYPE.title, fontWeight: "800" },
  subtitle: { fontSize: TYPE.small, lineHeight: 18, marginBottom: SPACING.xs },
  list: { padding: SPACING.m },
  empty: { alignItems: "center", gap: SPACING.s, paddingTop: SPACING.xl },
  emptyTitle: { fontSize: TYPE.h2, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: TYPE.body, lineHeight: 22, textAlign: "center", paddingHorizontal: SPACING.l },
  note: {
    marginTop: SPACING.m,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.m,
    backgroundColor: "rgba(0,0,0,0.06)",
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
  removeText: { fontSize: TYPE.small, fontWeight: "700" },
});
