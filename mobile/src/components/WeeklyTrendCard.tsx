import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ThemeTokens } from "../theme/tokens";
import { RADII, SPACING, TYPE } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { computeWeeklyTrend, trendLabel } from "../practice/insights";
import type { CorrectionRecord } from "../store/corrections";

interface WeeklyTrendCardProps {
  corrections: readonly CorrectionRecord[];
  tokens: ThemeTokens;
}

/**
 * Progress-over-time (learning brief Sections 2, 6): kept mistakes per week,
 * last 6 weeks, with an honest trend line ("Not enough data yet" until there
 * is one). Same card family as the rest of Learn — no new visual pattern.
 *
 * Deliberately shows kept-mistake COUNTS (what VUGA can actually see), not an
 * invented accuracy percentage.
 */
export function WeeklyTrendCard({ corrections, tokens: t }: WeeklyTrendCardProps) {
  const weeks = computeWeeklyTrend(corrections);
  const max = Math.max(...weeks.map((w) => w.keptMistakes), 1);
  const label = trendLabel(weeks);

  return (
    <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }, elevate("card", t)]}>
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: t.inkDim }]}>WEEKLY TREND</Text>
        <Text style={[styles.trendLabel, { color: t.teal }]}>{label}</Text>
      </View>
      <View style={styles.chartRow}>
        {weeks.map((w, i) => {
          const isCurrent = i === weeks.length - 1;
          const height = Math.round((w.keptMistakes / max) * 40);
          const date = new Date(w.weekStart);
          return (
            <View key={w.weekStart} style={styles.col}>
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(3, height),
                      backgroundColor: w.keptMistakes === 0 ? t.surface3 : isCurrent ? t.ochre : t.rust,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.weekLabel, { color: t.inkDim }]}>
                {isCurrent ? "now" : `${date.getMonth() + 1}/${date.getDate()}`}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.footnote, { color: t.inkDim }]}>
        Corrections you kept each week. The current week is still in progress.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    marginTop: SPACING.s,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    fontSize: TYPE.tiny,
    fontWeight: "700",
    letterSpacing: 1,
  },
  trendLabel: {
    fontSize: TYPE.tiny,
    fontWeight: "700",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  col: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  barArea: {
    height: 44,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },
  bar: {
    width: 18,
    borderRadius: 4,
  },
  weekLabel: {
    fontSize: TYPE.tiny - 1,
  },
  footnote: {
    fontSize: TYPE.tiny,
    lineHeight: 15,
    marginTop: 4,
    marginBottom: SPACING.xs,
  },
});
