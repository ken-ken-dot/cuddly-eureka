import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PhosphorIcon } from "./PhosphorIcon";
import { TriangleDivider } from "./TriangleDivider";
import type { ThemeTokens } from "../theme/tokens";
import { SPACING, TYPE } from "../theme/tokens";
import type { IconProps } from "phosphor-react-native";

type Glyph = React.ComponentType<IconProps>;

interface EmptyStateProps {
  tokens: ThemeTokens;
  /** Line-art icon family glyph, rendered in low-opacity accent gold. */
  icon: Glyph;
  title: string;
  body: string;
}

/**
 * The branded empty state: a quiet line-art mark in the accent gold at rest
 * opacity, a confident title, an instructional body, and the signature imigongo
 * divider. First-screen-quality — never plain text.
 */
export function EmptyState({ tokens: t, icon, title, body }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.mark, { borderColor: t.line }]}>
        <PhosphorIcon icon={icon} size={30} color={t.ochre} weight="light" />
      </View>
      <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
      <Text style={[styles.body, { color: t.inkDim }]}>{body}</Text>
      <TriangleDivider colors={[t.ochre, t.rust, t.moss]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.s,
    paddingHorizontal: SPACING.xl,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs,
    opacity: 0.85,
  },
  title: {
    fontSize: TYPE.h2,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    fontSize: TYPE.body,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: SPACING.s,
  },
});
