import React from "react";

import type { IconProps } from "phosphor-react-native";

type Glyph = React.ComponentType<IconProps>;

interface PhosphorIconProps extends IconProps {
  icon: Glyph;
}

/**
 * Single entry point for the app's icon family (Phosphor, duotone by default).
 * Keeps stroke weight, sizing and color usage consistent — call sites pass a
 * Phosphor component as `icon` and never import Phosphor directly.
 */
export function PhosphorIcon({ icon: Glyph, weight = "duotone", ...props }: PhosphorIconProps) {
  return <Glyph weight={weight} {...props} />;
}
