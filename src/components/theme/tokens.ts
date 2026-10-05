/**
 * TypeScript mirror of the design tokens that JS needs (Recharts, motion, SVG rings).
 * Values are CSS variable references, so they follow light/dark automatically:
 * never copy hex values into components. Source of truth: src/app/globals.css.
 */

export const NUTRIENT_KEYS = [
  "kcal",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "water",
  "weight",
  "activity",
  "over",
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export interface NutrientColor {
  /** Graphic fill: rings, bars, dots, chart series, icons. */
  fill: string;
  /** Tinted background for chips, badges, highlighted rows. */
  soft: string;
  /** Colored text: AA on card, background and `soft`. */
  strong: string;
}

export const nutrientColors: Record<NutrientKey, NutrientColor> = Object.fromEntries(
  NUTRIENT_KEYS.map((k) => [
    k,
    { fill: `var(--${k})`, soft: `var(--${k}-soft)`, strong: `var(--${k}-strong)` },
  ]),
) as Record<NutrientKey, NutrientColor>;

/** Chart palette + chrome for Recharts (`stroke={chartColors.series[0]}`). */
export const chartColors = {
  series: {
    1: "var(--chart-1)",
    2: "var(--chart-2)",
    3: "var(--chart-3)",
    4: "var(--chart-4)",
    5: "var(--chart-5)",
  },
  chrome: {
    grid: "var(--chart-grid)",
    axis: "var(--chart-axis)",
    target: "var(--chart-target)",
    track: "var(--track)",
    over: "var(--over)",
  },
} as const;

/** Durations in seconds (motion): mirror of --duration-* in globals.css. */
export const duration = {
  instant: 0.1,
  fast: 0.15,
  base: 0.2,
  slow: 0.3,
  slower: 0.5,
} as const;

/** Cubic-bezier easings: mirror of --ease-* in globals.css. */
export const ease = {
  out: [0.16, 1, 0.3, 1],
  in: [0.7, 0, 0.84, 0],
  inOut: [0.65, 0, 0.35, 1],
  emphasized: [0.2, 0, 0, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/**
 * Spring presets for `motion`. `ring` equals the CSS --ease-spring curve
 * (k=300, c=24 → ~5 % overshoot). Reduced motion is handled globally by
 * <MotionConfig reducedMotion="user"> in ThemeProvider.
 */
export const spring = {
  /** Progress rings & bars filling up. */
  ring: { type: "spring", stiffness: 300, damping: 24, mass: 1 },
  /** Press feedback, toggles, small UI. */
  snappy: { type: "spring", stiffness: 500, damping: 32, mass: 1 },
  /** Sheets, cards, layout shifts. */
  gentle: { type: "spring", stiffness: 220, damping: 28, mass: 1 },
  /** Celebration (goal reached, Milo): the one place for extra bounce. */
  bouncy: { type: "spring", stiffness: 380, damping: 16, mass: 1 },
} as const;

/** Theme colors for <meta name="theme-color">: must equal --background. */
export const themeColor = {
  light: "#f6f8f7",
  dark: "#0b0f0e",
} as const;
