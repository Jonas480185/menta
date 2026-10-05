import type { NutrientProfile, NutrientTotals } from "./types";

/** EU Regulation 1169/2011, Annex I: salt = sodium × 2.5. */
export const SALT_PER_SODIUM = 2.5;

/** Sodium (mg) derived from salt (g): salt / 2.5 × 1000. */
export function sodiumMgFromSaltG(saltG: number): number {
  return (saltG / SALT_PER_SODIUM) * 1000;
}

function assertAmount(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number >= 0, got ${value}`);
  }
}

/** per-100 value × amount / 100: multiply first, then divide (fewer rounding artefacts for whole grams). */
function scale(per100: number, amount: number): number {
  return (per100 * amount) / 100;
}

function scaleOptional(per100: number | null | undefined, amount: number): number | null {
  return per100 == null ? null : scale(per100, amount);
}

/**
 * Nutrients for `amount` base units (g or ml, matching the food's nutrient basis) of a food whose
 * values are given per 100 base units.
 *
 * - kcal/protein/carbs/fat are always numbers.
 * - Optional nutrients (fiber, sugar, saturated fat, sodium) stay `null` when unknown: an unknown
 *   value is never turned into 0.
 * - Sodium falls back to the salt value (salt / 2.5) when only salt is known (EU labels print salt).
 * - No rounding: values are stored as computed; round only for display (rounding.ts).
 *
 * @throws RangeError for negative / non-finite amounts (callers validate user input with Zod first).
 */
export function scaleNutrients(profilePer100: NutrientProfile, amount: number): NutrientTotals {
  assertAmount("amount", amount);
  const sodiumPer100 =
    profilePer100.sodiumMg ?? (profilePer100.saltG == null ? null : sodiumMgFromSaltG(profilePer100.saltG));
  return {
    kcal: scale(profilePer100.kcal, amount),
    proteinG: scale(profilePer100.proteinG, amount),
    carbsG: scale(profilePer100.carbsG, amount),
    fatG: scale(profilePer100.fatG, amount),
    fiberG: scaleOptional(profilePer100.fiberG, amount),
    sugarG: scaleOptional(profilePer100.sugarG, amount),
    saturatedFatG: scaleOptional(profilePer100.saturatedFatG, amount),
    sodiumMg: scaleOptional(sodiumPer100, amount),
  };
}

export interface EntryNutrientsInput {
  /** Nutrients per 100 g/ml of the food. */
  per100: NutrientProfile;
  /** Base units (g/ml) of ONE serving: `food_servings.grams`, 100 for the "100 g" serving. */
  servingGrams: number;
  /** Number of servings, e.g. 1.5. Must be > 0. */
  quantity: number;
}

export interface EntryNutrients {
  /** Total base units = servingGrams × quantity (→ `meal_entries.grams`). */
  grams: number;
  /** Nutrient snapshot for the entry (→ `meal_entries.kcal`, `protein_g`, …). */
  totals: NutrientTotals;
}

/**
 * The nutrient snapshot of a meal entry: exactly what Meal Logging stores on `meal_entries`
 * (`grams` plus the NutrientTotals columns). Recomputed whenever the entry's amount changes.
 *
 *   computeEntryNutrients({ per100: oats, servingGrams: 40, quantity: 1.5 })
 *   // → { grams: 60, totals: { kcal: 223.2, proteinG: 8.1, … } }
 *
 * @throws RangeError when servingGrams < 0, quantity <= 0 or any of them is not finite.
 */
export function computeEntryNutrients(input: EntryNutrientsInput): EntryNutrients {
  assertAmount("servingGrams", input.servingGrams);
  assertAmount("quantity", input.quantity);
  if (input.quantity === 0) throw new RangeError("quantity must be > 0");
  const grams = input.servingGrams * input.quantity;
  return { grams, totals: scaleNutrients(input.per100, grams) };
}
