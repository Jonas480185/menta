/**
 * Core nutrition value types shared by every domain module.
 * Pure TypeScript – no framework or DB imports allowed in src/domain/**.
 *
 * Units: energy kcal, macros g, sodium/minerals mg.
 */

/** Energy factors (Atwater general factors). */
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9, alcohol: 7 } as const;

export interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Nutrient amounts for an arbitrary quantity (an entry, a meal, a day). */
export interface NutrientTotals extends Macros {
  kcal: number;
  fiberG: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
}

/**
 * Nutrients per 100 units of the food's basis (100 g or 100 ml) – the "FoodNutrients"
 * value object stored on every food.
 */
export interface NutrientProfile extends Macros {
  kcal: number;
  fiberG?: number | null;
  sugarG?: number | null;
  saturatedFatG?: number | null;
  saltG?: number | null;
  sodiumMg?: number | null;
  potassiumMg?: number | null;
  calciumMg?: number | null;
  ironMg?: number | null;
  micronutrients?: Record<string, number> | null;
}

export type NutrientBasis = "g" | "ml";

/** Targets for one day, resolved from the user's goal profile(s). */
export interface DailyTargets extends Macros {
  calories: number;
  fiberG: number | null;
  goalProfileId: string | null;
  goalProfileName: string | null;
}

/** Optional nutrients of NutrientTotals – `null` means "unknown", never "zero". */
export const OPTIONAL_TOTAL_KEYS = ["fiberG", "sugarG", "saturatedFatG", "sodiumMg"] as const;
export type OptionalTotalKey = (typeof OPTIONAL_TOTAL_KEYS)[number];

/** Always-known nutrients of NutrientTotals (a missing value would make the entry invalid). */
export const REQUIRED_TOTAL_KEYS = ["kcal", "proteinG", "carbsG", "fatG"] as const;
export type RequiredTotalKey = (typeof REQUIRED_TOTAL_KEYS)[number];

/**
 * What is left of the day's targets. Values may be negative (= over target).
 * `kcal` already includes counted activity calories (budget = target + activity).
 */
export interface NutrientRemaining extends Macros {
  kcal: number;
  /** null when the day has no fiber target. */
  fiberG: number | null;
}

/**
 * Progress state of one nutrient against its target (see targets.ts for thresholds):
 * - none:    nothing consumed yet
 * - under:   < 90 %
 * - near:    90 % … < 100 %
 * - reached: 100 % … 105 % (and above for "more is fine" nutrients like protein/fiber)
 * - over:    > 105 %
 */
export type NutrientStatus = "none" | "under" | "near" | "reached" | "over";

/** Status per displayed nutrient for a day. `fiber` is null without a fiber target. */
export interface DayNutrientStatus {
  kcal: NutrientStatus;
  protein: NutrientStatus;
  carbs: NutrientStatus;
  fat: NutrientStatus;
  fiber: NutrientStatus | null;
}

export const ZERO_TOTALS: NutrientTotals = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: null,
  sugarG: null,
  saturatedFatG: null,
  sodiumMg: null,
};
