import React from "react";
import { View } from "react-native";

interface TriangleDividerProps {
  colors: [string, string, string];
  count?: number;
  size?: number;
}

function SmallTriangle({ size, color, flip }: { size: number; color: string; flip?: boolean }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size / 2,
        borderRightWidth: size / 2,
        ...(flip
          ? { borderTopWidth: size * 0.8, borderTopColor: color }
          : { borderBottomWidth: size * 0.8, borderBottomColor: color }),
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        marginHorizontal: size * 0.25,
      }}
    />
  );
}

/** The signature imigongo triangle divider — part of the brand, not decoration. */
export function TriangleDivider({ colors, count = 9, size = 9 }: TriangleDividerProps) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessible={false}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 2 }}
    >
      {items.map((i) => (
        <SmallTriangle key={i} size={size} color={colors[i % 3] as string} flip={i % 2 === 1} />
      ))}
    </View>
  );
}
