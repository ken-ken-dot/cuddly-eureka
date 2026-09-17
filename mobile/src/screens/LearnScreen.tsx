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

import { Ticket as TicketIcon, X } from "phosphor-react-native";
import { PhosphorIcon } from "../components/PhosphorIcon";

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
