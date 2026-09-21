import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ThemeTokens } from "../theme/tokens";
import { RADII, SPACING, TYPE } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { DEFAULT_TOPIC } from "../corrections/data";
import { computeWeakPoints, type WeakPoint } from "../practice/insights";
import type { CorrectionRecord } from "../store/corrections";

interface WeakPointsCardProps {
  corrections: readonly CorrectionRecord[];
  tokens: ThemeTokens;
}

/**
 * Weak-point ranking (learning brief Sections 2, 6) — an expansion of the
 * Learn progress card in the same card style and tokens (no new visual
 * language). Topics rank by mistake frequency weighted by recency: a mistake
 * from yesterday outranks one from months ago that hasn't recurred.
 *
 * Works identically signed-in or signed-out — it reads local AsyncStorage
 * corrections, which stay the source of truth for the immediate UI.
 */
export function WeakPointsCard({ corrections, tokens: t }: WeakPointsCardProps) {
  const points = computeWeakPoints(corrections).slice(0, 3);
  if (points.length === 0) return null; // Progress card's empty state already covers this

  const max = Math.max(...points.map((p) => p.score), 0.0001);

  return (
    <View style={[styles.card, { backgroundColor: t.surface2, borderColor: t.line }, elevate("card", t)]}>
      <Text style={[styles.heading, { color: t.inkDim }]}>WHERE TO FOCUS</Text>
      {points.map((p, i) => (
        <View
          key={p.topic}
          style={styles.row}
          accessible
          accessibilityLabel={`${rankLabel(i)} to focus: ${topicLabel(p.topic)}. ${p.total} mistake${p.total === 1 ? "" : "s"} kept, most recent ${agoLabel(p.lastAt)}.`}
        >
          <Text style={[styles.topic, { color: t.ink }]}>{topicLabel(p.topic)}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.bar,
                { width: `${Math.max(12, Math.round((p.score / max) * 100))}%`, backgroundColor: i === 0 ? t.rust : t.ochre },
              ]}
            />
          </View>
          <Text style={[styles.ago, { color: t.inkDim }]}>{agoLabel(p.lastAt)}</Text>
        </View>
      ))}
      <Text style={[styles.footnote, { color: t.inkDim }]}>
        Ranked by how often you kept a mistake in a topic and how recently — only mistakes in the
        curated list can appear here.
      </Text>
    </View>
  );
}

function rankLabel(i: number): string {
  return i === 0 ? "Top" : i === 1 ? "Second" : "Third";
}

function topicLabel(topic: string): string {
  const capitalized = topic === DEFAULT_TOPIC ? "general" : topic.replace(/-/g, " ");
  return capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
}

function agoLabel(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    marginTop: SPACING.s,
  },
  heading: {
    fontSize: TYPE.tiny,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: SPACING.s,
  },
  topic: { width: 96, fontSize: TYPE.small, fontWeight: "700" },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: "transparent" },
  bar: { height: 8, borderRadius: 4 },
  ago: { fontSize: TYPE.tiny, width: 56, textAlign: "right" },
  footnote: { fontSize: TYPE.tiny, lineHeight: 15, marginTop: SPACING.xs, marginBottom: SPACING.xs },
});
