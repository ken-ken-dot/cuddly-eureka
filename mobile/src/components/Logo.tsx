import React from "react";
import { View } from "react-native";

interface LogoProps {
  size?: number;
  ochre: string;
  rust: string;
}

function Triangle({ width, height, color, flip }: { width: number; height: number; color: string; flip?: boolean }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: width / 2,
        borderRightWidth: width / 2,
        ...(flip
          ? { borderTopWidth: height, borderTopColor: color }
          : { borderBottomWidth: height, borderBottomColor: color }),
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
      }}
    />
  );
}

/**
 * The VUGA logomark: two triangles — a tall ochre peak and a shorter rust
 * peak — side by side, referencing imigongo art. Pure Views, no assets.
 */
export function Logo({ size = 28, ochre, rust }: LogoProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="VUGA logo"
      style={{ flexDirection: "row", alignItems: "flex-end", height: size }}
    >
      <Triangle width={size * 0.72} height={size} color={ochre} />
      <View style={{ width: size * 0.12 }} />
      <Triangle width={size * 0.58} height={size * 0.78} color={rust} />
    </View>
  );
}
