/**
 * Macro math: grams ↔ percent ↔ kcal with one consistent rounding strategy.
 *
 * Rounding strategy ("carbs balance"), see docs/architecture/macro-engine.md §3:
 *   1. Protein and fat are rounded to whole grams (nearest).
 *   2. Carbs are the balancing macro: C = round((kcal − 4P − 9F) / 4).
 *      → |4P + 4C + 9F − kcal| ≤ 2 kcal.
 *   3. If the exact carb amount is < 1 g (e.g. a 0 % carb profile) or the balance would go negative,
 *      carbs are 0 and fat balances instead: F = round((kcal − 4P) / 9) → deviation ≤ 4.5 kcal.
 *   4. If even protein alone exceeds the target, protein balances: P = round(kcal / 4).
 * The deviation is therefore always ≤ MACRO_KCAL_TOLERANCE (5 kcal).
 */
import { KCAL_PER_G } from "@/domain/nutrition/types";
import {
  MacroInputError,
  type MacroCalculation,
  type MacroPercents,
  type MacroWarning,
  type Macros,
} from "./types";

/** Max |4P + 4C + 9F − kcal| after fitting integer grams (see strategy above). */
export const MACRO_KCAL_TOLERANCE = 5;

/** Percent sums within 100 ± this are accepted (and normalized to exactly 100). */
export const PERCENT_SUM_TOLERANCE = 0.5;

/** Upper sanity bound for calorie targets handled by the engine. */
export const MAX_KCAL = 20_000;

/** Upper sanity bound for a single macro in grams per day. */
export const MAX_MACRO_G = 2_000;

export const LOW_CALORIES_THRESHOLD = 1200;
export const VERY_LOW_CARBS_G = 50;

// ── Basics ──────────────────────────────────────────────────────────────────

/** Energy of the given grams: 4 · protein + 4 · carbs + 9 · fat (kcal, unrounded). */
export function kcalFromGrams(grams: Macros): number {
  return grams.proteinG * KCAL_PER_G.protein + grams.carbsG * KCAL_PER_G.carbs + grams.fatG * KCAL_PER_G.fat;
}

/** Energy per macro plus total: for "150 g Protein = 600 kcal" style breakdowns. */
export function macroEnergyBreakdown(grams: Macros): {
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
  totalKcal: number;
} {
  const proteinKcal = grams.proteinG * KCAL_PER_G.protein;
  const carbsKcal = grams.carbsG * KCAL_PER_G.carbs;
  const fatKcal = grams.fatG * KCAL_PER_G.fat;
  return { proteinKcal, carbsKcal, fatKcal, totalKcal: proteinKcal + carbsKcal + fatKcal };
}

/**
 * Energy shares of the given grams in percent (unrounded; sum = 100).
 * All zeros when the grams contain no energy.
 */
export function percentFromGrams(grams: Macros): MacroPercents {
  assertGrams(grams);
  const e = macroEnergyBreakdown(grams);
  if (e.totalKcal === 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: (e.proteinKcal / e.totalKcal) * 100,
    carbs: (e.carbsKcal / e.totalKcal) * 100,
    fat: (e.fatKcal / e.totalKcal) * 100,
  };
}

export interface ConsistencyResult {
  /** 4P + 4C + 9F of the given grams. */
  macroKcal: number;
  /** macroKcal − kcal. Positive = macros contain more energy than the target. */
  diffKcal: number;
  /** diffKcal relative to kcal in percent. */
  diffPct: number;
  /** |diffKcal| ≤ tolerance. */
  withinTolerance: boolean;
  tolerance: number;
}

/** How far the energy of `macros` is from the calorie target `kcal`. */
export function checkConsistency(
  kcal: number,
  macros: Macros,
  tolerance: number = MACRO_KCAL_TOLERANCE,
): ConsistencyResult {
  assertKcal(kcal);
  assertGrams(macros);
  const macroKcal = kcalFromGrams(macros);
  const diffKcal = macroKcal - kcal;
  return {
    macroKcal,
    diffKcal,
    diffPct: (diffKcal / kcal) * 100,
    withinTolerance: Math.abs(diffKcal) <= tolerance + 1e-9,
    tolerance,
  };
}

// ── Rounding ────────────────────────────────────────────────────────────────

/**
 * Fits exact (fractional) grams to integer grams whose energy matches `kcal` within
 * MACRO_KCAL_TOLERANCE. Carbs balance (see module doc). Inputs must be ≥ 0.
 */
export function fitMacrosToKcal(kcal: number, exact: Macros): Macros {
  assertKcal(kcal);
  assertGrams(exact);
  let proteinG = Math.round(exact.proteinG);
  let fatG = Math.round(exact.fatG);
  let carbsG = 0;

  if (exact.carbsG >= 1) {
    carbsG = Math.round((kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs);
  }
  if (exact.carbsG < 1 || carbsG < 0) {
    carbsG = 0;
    fatG = Math.round((kcal - proteinG * KCAL_PER_G.protein) / KCAL_PER_G.fat);
    if (fatG < 0) {
      fatG = 0;
      proteinG = Math.round(kcal / KCAL_PER_G.protein);
    }
  }
  return { proteinG, carbsG, fatG };
}

// ── Modes ───────────────────────────────────────────────────────────────────

/**
 * Percent mode: grams from energy shares. Percents must sum to 100 ± 0.5 (they are then normalized
 * to exactly 100, so 33.3/33.3/33.4 works).
 *
 *   macrosFromPercent(2000, { protein: 30, carbs: 40, fat: 30 })
 *   // → macros { proteinG: 150, carbsG: 199, fatG: 67 }, macroKcal 1999 (diff −1 kcal)
 */
export function macrosFromPercent(kcal: number, percents: MacroPercents): MacroCalculation {
  assertKcal(kcal);
  const p = normalizePercents(percents);
  const exact: Macros = {
    proteinG: (kcal * p.protein) / 100 / KCAL_PER_G.protein,
    carbsG: (kcal * p.carbs) / 100 / KCAL_PER_G.carbs,
    fatG: (kcal * p.fat) / 100 / KCAL_PER_G.fat,
  };
  return buildCalculation(kcal, fitMacrosToKcal(kcal, exact));
}

/**
 * Grams mode: protein and fat are fixed by the user (rounded to whole grams, never adjusted),
 * carbs fill the remaining energy: C = (kcal − 4P − 9F) / 4.
 * If protein + fat already exceed the target, carbs are 0 and the result carries a
 * `carbs_negative` warning (macroKcal > kcal): services reject that case.
 */
export function macrosFromGrams(
  kcal: number,
  grams: { proteinG: number; fatG: number },
): MacroCalculation & { carbsRemainderG: number } {
  assertKcal(kcal);
  assertGrams({ proteinG: grams.proteinG, carbsG: 0, fatG: grams.fatG });
  const proteinG = Math.round(grams.proteinG);
  const fatG = Math.round(grams.fatG);
  const carbsRemainderG = (kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs;
  const carbsG = carbsRemainderG < 0 ? 0 : Math.round(carbsRemainderG);
  const calc = buildCalculation(kcal, { proteinG, carbsG, fatG });
  if (carbsRemainderG < 0) {
    const over = Math.round(-carbsRemainderG * KCAL_PER_G.carbs);
    calc.warnings = [
      {
        code: "carbs_negative",
        message: `Protein und Fett ergeben schon ${formatInt(calc.macroKcal)} kcal, also ${formatInt(over)} kcal mehr als dein Ziel. Reduziere Protein oder Fett, oder erhöhe das Kalorienziel.`,
      },
      ...calc.warnings.filter((w) => w.code !== "carbs_very_low"),
    ];
  }
  return { ...calc, carbsRemainderG };
}

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Validates percents (each 0-100, sum 100 ± 0.5) and scales them to sum exactly 100. */
export function normalizePercents(percents: MacroPercents): MacroPercents {
  for (const key of ["protein", "carbs", "fat"] as const) {
    const v = percents[key];
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      throw new MacroInputError(
        "invalid_percent",
        "Prozentwerte müssen zwischen 0 und 100 liegen.",
        `percents.${key}`,
      );
    }
  }
  const sum = percents.protein + percents.carbs + percents.fat;
  if (Math.abs(sum - 100) > PERCENT_SUM_TOLERANCE) {
    throw new MacroInputError(
      "percent_sum",
      `Die Makros müssen zusammen 100 % ergeben (aktuell ${formatDecimal(sum)} %).`,
      "percents",
    );
  }
  return {
    protein: (percents.protein / sum) * 100,
    carbs: (percents.carbs / sum) * 100,
    fat: (percents.fat / sum) * 100,
  };
}

/** Assembles a MacroCalculation (energy, diff, effective percents, warnings) for fitted grams. */
export function buildCalculation(
  kcal: number,
  macros: Macros,
  opts: { weightKg?: number } = {},
): MacroCalculation {
  const macroKcal = kcalFromGrams(macros);
  return {
    kcal,
    macros,
    macroKcal,
    diffKcal: macroKcal - kcal,
    percents: percentFromGrams(macros),
    warnings: assessMacros(kcal, macros, opts.weightKg),
  };
}

/** Friendly, non-blocking hints about a set of targets. */
export function assessMacros(kcal: number, macros: Macros, weightKg?: number): MacroWarning[] {
  const warnings: MacroWarning[] = [];
  if (kcal < LOW_CALORIES_THRESHOLD) {
    warnings.push({
      code: "calories_low",
      message: `Unter ${formatInt(LOW_CALORIES_THRESHOLD)} kcal ist es schwer, alle Nährstoffe zu decken. Sprich so ein Ziel am besten mit einer Fachperson ab.`,
    });
  }
  if (macros.carbsG < VERY_LOW_CARBS_G) {
    warnings.push({
      code: "carbs_very_low",
      message: "Sehr wenig Kohlenhydrate. Passt zu Keto, für Training kann Energie fehlen.",
    });
  }
  const fatShare = kcal > 0 ? (macros.fatG * KCAL_PER_G.fat) / kcal : 0;
  const fatPerKg = weightKg ? macros.fatG / weightKg : undefined;
  if (fatShare < 0.2 || (fatPerKg !== undefined && fatPerKg < 0.5)) {
    warnings.push({
      code: "fat_low",
      message:
        "Wenig Fett. Für Hormone und fettlösliche Vitamine sind mindestens ~20 % der Kalorien sinnvoll.",
    });
  }
  if (weightKg && macros.proteinG / weightKg > 2.5) {
    warnings.push({
      code: "protein_high",
      message: "Mehr als 2,5 g Protein pro kg bringt meist keinen zusätzlichen Nutzen.",
    });
  }
  return warnings;
}

export function assertKcal(kcal: number): void {
  if (!Number.isFinite(kcal) || kcal <= 0 || kcal > MAX_KCAL) {
    throw new MacroInputError(
      "invalid_kcal",
      `Das Kalorienziel muss zwischen 1 und ${formatInt(MAX_KCAL)} kcal liegen.`,
      "calorieTarget",
    );
  }
}

export function assertGrams(grams: Macros): void {
  for (const key of ["proteinG", "carbsG", "fatG"] as const) {
    const v = grams[key];
    if (!Number.isFinite(v) || v < 0 || v > MAX_MACRO_G) {
      throw new MacroInputError(
        "invalid_grams",
        `Grammwerte müssen zwischen 0 und ${formatInt(MAX_MACRO_G)} g liegen.`,
        `grams.${key}`,
      );
    }
  }
}

const intFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
function formatInt(n: number): string {
  return intFmt.format(n);
}
function formatDecimal(n: number): string {
  return decFmt.format(n);
}
