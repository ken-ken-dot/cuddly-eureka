import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ThemeTokens } from "../theme/tokens";
import { RADII, SPACING, TYPE } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { TOPIC_ORDER, DEFAULT_TOPIC } from "../corrections/data";
import { levelLabel, type ProficiencyReport } from "../corrections/proficiency";

interface TopicBreakdownProps {
  report: ProficiencyReport;
  tokens: ThemeTokens;
}

/**
 * V3 proficiency breakdown — an expansion of the Learn progress section, in the
 * same card style and token colors (no new visual pattern): more rows, plus a
 * small per-topic level meter built from the same tokens.
 *
 * Honest labeling, per the brief: this is a progress indicator based on the
 * user's own activity on this device — not a certified assessment. No CEFR
 * language, no "fluent".
 */
export function TopicBreakdown({ report, tokens: t }: TopicBreakdownProps) {

  const ordered = [...report.topics].sort((a, b) => {
    const ia = TOPIC_ORDER.indexOf(a.topic as (typeof TOPIC_ORDER)[number]);
    const ib = TOPIC_ORDER.indexOf(b.topic as (typeof TOPIC_ORDER)[number]);
    return (ia === -1 ? TOPIC_ORDER.length : ia) - (ib === -1 ? TOPIC_ORDER.length : ib) || a.topic.localeCompare(b.topic);
  });
  const practiced = ordered.filter((tp) => tp.mistakes > 0 || tp.clean > 0);
  if (practiced.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }, elevate("card", t)]}>
        <Text style={[styles.emptyText, { color: t.inkDim }]}>
          Keep a correction or translate a typed phrase and your per-topic progress will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }, elevate("card", t)]}>
      {practiced.map((tp) => (
        <View
          key={tp.topic}
          style={styles.row}
          accessible
          accessibilityLabel={`${topicLabel(tp.topic)}: ${levelLabel(tp.level)}. ${tp.mistakes} mistake${tp.mistakes === 1 ? "" : "s"} kept, ${tp.clean} clean exchange${tp.clean === 1 ? "" : "s"}.`}
        >
          <Text style={[styles.topic, { color: t.ink }]}>{topicLabel(tp.topic)}</Text>
          <LevelMeter level={tp.level} tokens={t} />
          <Text style={[styles.levelText, { color: t.inkDim }]}>{levelLabel(tp.level)}</Text>
        </View>
      ))}
      <Text style={[styles.footnote, { color: t.inkDim }]}>
        A progress indicator based on your own kept corrections and exchanges on this device — not a
        certified assessment, and it only sees mistakes in the curated list.
      </Text>
    </View>
  );
}

function topicLabel(topic: string): string {
  return topic === DEFAULT_TOPIC ? "general" : topic.replace(/-/g, " ");
}

/** A 4-segment level meter using existing tokens — rust = needs attention,
 * ochre = partial, moss = solid. */
function LevelMeter({ level, tokens }: { level: 0 | 1 | 2 | 3; tokens: ThemeTokens }) {
  const t = tokens;
  return (
    <View style={styles.meter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.seg,
            {
              backgroundColor:
                i <= level ? (level <= 1 ? t.rust : level === 2 ? t.ochre : t.moss) : t.surface3,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: SPACING.s,
  },
  topic: { flex: 1, fontSize: TYPE.body },
  meter: { flexDirection: "row", gap: 3 },
  seg: { width: 16, height: 8, borderRadius: 4 },
  levelText: { fontSize: TYPE.small, width: 96, textAlign: "right" },
  footnote: { fontSize: TYPE.tiny, lineHeight: 15, marginTop: SPACING.xs, marginBottom: SPACING.xs },
  emptyText: { fontSize: TYPE.small, lineHeight: 18 },
});
