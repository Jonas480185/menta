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

/** Shared field look (Input, Textarea, SelectTrigger, NumberInput). */
export const fieldClasses = [
  "w-full min-w-0 rounded-md border border-input bg-background text-base text-foreground shadow-xs shadow-foreground/5",
  "transition-[border-color,box-shadow] duration-150 outline-none motion-reduce:transition-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
  "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

/**
 * Floating surface (Popover, Select, DropdownMenu). Enter animation uses `@starting-style`
 * (`starting:` variant) so no animation plugin is needed; exits are instant by design.
 */
export const floatingSurface = [
  "z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg shadow-foreground/10 outline-none",
  "transition-[opacity,scale] duration-150 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none",
].join(" ");

/** Menu / listbox row: 44 px on touch, compact on precise pointers. */
export const menuItem = [
  "relative flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-base outline-none select-none pointer-fine:min-h-9 pointer-fine:text-sm",
  "focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
].join(" ");

/** Modal scrim: dark in both themes (≈40–75 % darkening), subtle blur. */
export const overlayScrim = [
  "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[2px] dark:bg-background/75",
  "transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none",
].join(" ");
