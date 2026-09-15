export interface ThemeTokens {
  surface: string;
  surface2: string;
  surface3: string;
  ink: string;
  inkDim: string;
  rust: string;
  rustSoft: string;
  ochre: string;
  moss: string;
  mossSoft: string;
  line: string;
}

export const DARK: ThemeTokens = {
  surface: "#1C1815",
  surface2: "#252019",
  surface3: "#2E2721",
  ink: "#F1E9DA",
  inkDim: "#C9BFAE",
  rust: "#B0432B",
  rustSoft: "#7A331F",
  ochre: "#D6A24C",
  moss: "#4B6E62",
  mossSoft: "#324B42",
  line: "rgba(241,233,218,0.14)",
} as const;

export const LIGHT: ThemeTokens = {
  surface: "#F6F7F5",
  surface2: "#EDEEEA",
  surface3: "#E2E4DE",
  ink: "#1C1815",
  inkDim: "#5C564C",
  rust: "#B0432B",
  rustSoft: "#E7C3B9",
  ochre: "#B9822E",
  moss: "#3D5A50",
  mossSoft: "#DCE7E2",
  line: "rgba(28,24,21,0.12)",
} as const;

export const SPACING = { xs: 4, s: 8, m: 16, l: 24, xl: 32 } as const;

export const RADII = { s: 8, m: 12, l: 16, ticket: 6 } as const;

export const TYPE = {
  title: 28,
  h2: 20,
  body: 16,
  small: 13,
  tiny: 11,
} as const;
