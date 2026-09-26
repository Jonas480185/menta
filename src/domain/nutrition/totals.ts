import {
  KCAL_PER_G,
  OPTIONAL_TOTAL_KEYS,
  REQUIRED_TOTAL_KEYS,
  type Macros,
  type NutrientTotals,
} from "./types";

/**
 * Sums nutrient totals (entries → meal → day → range).
 *
 * Null semantics (identical to SQL `SUM()`, so in-memory and database aggregates agree):
 * - kcal / protein / carbs / fat: plain sum (always numbers). Empty list → 0.
 * - Optional nutrients (fiber, sugar, saturated fat, sodium): sum of the KNOWN values;
 *   `null` only if every value in the list is null (or the list is empty).
 *   A partially known sum is therefore a lower bound ("at least 12 g fiber"), never a guess.
 *
 * Always returns a new object.
 */
export function sumTotals(list: readonly NutrientTotals[]): NutrientTotals {
  const out: NutrientTotals = {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: null,
    sugarG: null,
    saturatedFatG: null,
    sodiumMg: null,
  };
  for (const t of list) {
    for (const key of REQUIRED_TOTAL_KEYS) out[key] += t[key];
    for (const key of OPTIONAL_TOTAL_KEYS) {
      const v = t[key];
      if (v != null) out[key] = (out[key] ?? 0) + v;
    }
  }
  return out;
}

/**
 * Energy from macronutrients with the Atwater general factors (4/4/9, alcohol 7):
 *   kcal = 4·protein + 4·carbs + 9·fat (+ 7·alcohol)
 * Used for plausibility checks and the macro split – the label kcal of a food stays authoritative.
 */
export function kcalFromMacros(macros: Macros & { alcoholG?: number | null }): number {
  return (
    macros.proteinG * KCAL_PER_G.protein +
    macros.carbsG * KCAL_PER_G.carbs +
    macros.fatG * KCAL_PER_G.fat +
    (macros.alcoholG ?? 0) * KCAL_PER_G.alcohol
  );
}

/** Share of energy from each macro as a RATIO 0–1 (format with `formatPercent`). */
export interface MacroEnergySplit {
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Energy split of protein/carbs/fat as ratios of the MACRO energy (4/4/9), so the three always
 * add up to 1 (100 %). The label kcal is deliberately not the denominator: it also contains
 * alcohol, fibre and polyols and would make the split not sum to 100 %.
 * No macros at all → { 0, 0, 0 }.
 *
 *   macroEnergySplit({ proteinG: 150, carbsG: 200, fatG: 67 }) // ≈ { protein: 0.30, carbs: 0.40, fat: 0.30 }
 */
export function macroEnergySplit(totals: Macros): MacroEnergySplit {
  const p = totals.proteinG * KCAL_PER_G.protein;
  const c = totals.carbsG * KCAL_PER_G.carbs;
  const f = totals.fatG * KCAL_PER_G.fat;
  const sum = p + c + f;
  if (!(sum > 0)) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: p / sum, carbs: c / sum, fat: f / sum };
}
