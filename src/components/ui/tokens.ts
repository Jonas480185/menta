/**
 * Shared class-name building blocks for the component library, built on the design
 * tokens in src/app/globals.css (docs/design/design-system.md).
 *
 * Tailwind only generates classes it can find as complete literal strings, so every
 * token → class mapping lives here as a static lookup table (never build class names
 * with template strings like `bg-${tone}`).
 */

/** Semantic colour tones a data visual (ring, bar, chip, badge, icon well) can take. */
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
  | "over"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "muted";

/**
 * Graphic fill as text colour – drives SVG strokes / icons via `currentColor`
 * (rings, dots). Not for small text: use `toneStrong`.
 */
export const toneGraphic: Record<Tone, string> = {
  primary: "text-primary",
  kcal: "text-kcal",
  protein: "text-protein",
  carbs: "text-carbs",
  fat: "text-fat",
  fiber: "text-fiber",
  water: "text-water",
  weight: "text-weight",
  activity: "text-activity",
  over: "text-over",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

/** Solid background fill (bars, dots, caps). */
export const toneFill: Record<Tone, string> = {
  primary: "bg-primary",
  kcal: "bg-kcal",
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
  fiber: "bg-fiber",
  water: "bg-water",
  weight: "bg-weight",
  activity: "bg-activity",
  over: "bg-over",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
};

/** Tinted background for chips, badges and icon wells. */
export const toneSoft: Record<Tone, string> = {
  primary: "bg-primary-soft",
  kcal: "bg-kcal-soft",
  protein: "bg-protein-soft",
  carbs: "bg-carbs-soft",
  fat: "bg-fat-soft",
  fiber: "bg-fiber-soft",
  water: "bg-water-soft",
  weight: "bg-weight-soft",
  activity: "bg-activity-soft",
  over: "bg-over-soft",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  info: "bg-info-soft",
  destructive: "bg-destructive-soft",
  muted: "bg-muted",
};

/** Coloured text that is AA on card, background and the matching `toneSoft`. */
export const toneStrong: Record<Tone, string> = {
  primary: "text-primary-strong",
  kcal: "text-kcal-strong",
  protein: "text-protein-strong",
  carbs: "text-carbs-strong",
  fat: "text-fat-strong",
  fiber: "text-fiber-strong",
  water: "text-water-strong",
  weight: "text-weight-strong",
  activity: "text-activity-strong",
  over: "text-over-strong",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

/**
 * Keyboard focus indicator – the design-system `focus-ring` utility (2 px `--ring`
 * outline, 2 px offset), identical to the global `:focus-visible` style.
 */
export const focusRing = "focus-ring";

/** Focus ring for rows inside `overflow-hidden` containers (drawn inside the element). */
export const focusRingInset =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

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

/** Shared field look (Input, Textarea, SelectTrigger, NumberInput). */
export const fieldClasses = [
  "w-full min-w-0 rounded-control border border-input bg-card text-body text-foreground",
  "transition-[border-color,box-shadow] duration-150 outline-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
  "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

/**
 * Floating surface (Popover, Select, DropdownMenu) – elevation level 2: shadow in light,
 * hairline in dark. Radix keeps the element mounted until the exit animation ends.
 */
export const floatingSurface = [
  "z-50 rounded-lg border border-transparent bg-popover text-popover-foreground shadow-md outline-none dark:border-border",
  "data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out",
].join(" ");

/** Menu / listbox row: 44 px on touch, compact on precise pointers. */
export const menuItem = [
  "relative flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-body outline-none select-none pointer-fine:min-h-9 pointer-fine:text-body-sm",
  "focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
].join(" ");

/** Modal scrim (`--overlay`: ink 40 % light, black 60 % dark) with fade in/out. */
export const overlayScrim =
  "fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out";

/** Card surface – elevation level 1: soft shadow in light, hairline border in dark. */
export const cardSurface =
  "rounded-card border border-transparent bg-card text-card-foreground shadow-sm dark:border-border";
