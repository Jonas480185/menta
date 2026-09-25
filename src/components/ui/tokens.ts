/**
 * Shared class-name building blocks for the component library.
 *
 * Tailwind only generates classes it can find as complete literal strings, so every
 * token → class mapping lives here as a static lookup table (never build class names
 * with template strings like `bg-${tone}`).
 */

/** Semantic colour tones a data visual (ring, bar, chip, badge) can take. */
export type Tone =
  | "primary"
  | "kcal"
  | "protein"
  | "carbs"
  | "fat"
  | "fiber"
  | "water"
  | "weight"
  | "activity"
  | "success"
  | "warning"
  | "over"
  | "muted";

/** Solid foreground colour (also drives SVG strokes via `currentColor`). */
export const toneText: Record<Tone, string> = {
  primary: "text-primary",
  kcal: "text-kcal",
  protein: "text-protein",
  carbs: "text-carbs",
  fat: "text-fat",
  fiber: "text-fiber",
  water: "text-water",
  weight: "text-weight",
  activity: "text-activity",
  success: "text-success",
  warning: "text-warning",
  over: "text-over",
  muted: "text-muted-foreground",
};

/** Solid background fill. */
export const toneBg: Record<Tone, string> = {
  primary: "bg-primary",
  kcal: "bg-kcal",
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
  fiber: "bg-fiber",
  water: "bg-water",
  weight: "bg-weight",
  activity: "bg-activity",
  success: "bg-success",
  warning: "bg-warning",
  over: "bg-over",
  muted: "bg-muted-foreground",
};

/** Soft tinted background (≈15 % of the tone) for chips, icon wells and tracks. */
export const toneSoftBg: Record<Tone, string> = {
  primary: "bg-primary/15",
  kcal: "bg-kcal/15",
  protein: "bg-protein/15",
  carbs: "bg-carbs/15",
  fat: "bg-fat/15",
  fiber: "bg-fiber/15",
  water: "bg-water/15",
  weight: "bg-weight/15",
  activity: "bg-activity/15",
  success: "bg-success/15",
  warning: "bg-warning/15",
  over: "bg-over/15",
  muted: "bg-muted",
};

/** Visible, consistent keyboard focus ring (never remove without a replacement). */
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Expands the hit area of a visually small control to ≥ 44 px on coarse pointers
 * without changing its visual size. The element must be `relative`.
 */
export const touchTarget =
  "relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-[''] pointer-fine:after:hidden";

/** German display names for nutrient tones (used in labels and aria texts). */
export const nutrientLabel = {
  kcal: "Kalorien",
  protein: "Protein",
  carbs: "Kohlenhydrate",
  fat: "Fett",
  fiber: "Ballaststoffe",
  water: "Wasser",
} as const;
