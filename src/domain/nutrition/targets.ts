import type {
  DailyTargets,
  DayNutrientStatus,
  NutrientRemaining,
  NutrientStatus,
  NutrientTotals,
} from "./types";

/**
 * Status thresholds as RATIOS of consumed / target (docs/product/information-architecture.md,
 * "Zustände Kalorien-Ring"):
 *   under   < 0.90
 *   near    0.90 ≤ r < 1.00   „Fast geschafft“
 *   reached 1.00 ≤ r ≤ 1.05   „Ziel erreicht“ (5 % tolerance: a few kcal over is still "reached")
 *   over    r > 1.05          „… über Ziel“ (`over` token, never an alarm)
 * The same thresholds apply to macros so ring and bars never disagree.
 */
export const STATUS_THRESHOLDS = {
  near: 0.9,
  reached: 1,
  over: 1.05,
} as const;

/**
 * consumed / target as an unclamped ratio (1.2 = 120 %). Returns `null` when there is no
 * meaningful target (≤ 0, null or not finite): the UI then shows the amount without a bar.
 * Negative consumption (impossible for valid entries) is treated as 0.
 */
export function progressRatio(consumed: number, target: number | null | undefined): number | null {
  if (target == null || !Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(consumed) || consumed <= 0) return 0;
  return consumed / target;
}

export interface MacroStatusOptions {
  /**
   * "More is fine" nutrients (protein, fiber): exceeding the target is neutral/positive
   * („Ziel übertroffen“), so anything ≥ 100 % is `reached`, never `over`. Default false.
   */
  exceedIsNeutral?: boolean;
}

/**
 * Status of one nutrient against its target (see STATUS_THRESHOLDS).
 * - consumed ≤ 0 → `none` (nothing of it eaten yet), regardless of the target.
 * - target 0 (e.g. a zero-carb profile) and consumed > 0 → `over` (`reached` if exceedIsNeutral).
 *
 *   macroStatus(1620, 2300) // "under"
 *   macroStatus(66, 64)     // "reached" (103 %: within the 5 % tolerance)
 *   macroStatus(180, 150, { exceedIsNeutral: true }) // "reached"
 */
export function macroStatus(
  consumed: number,
  target: number,
  options: MacroStatusOptions = {},
): NutrientStatus {
  if (!Number.isFinite(consumed) || consumed <= 0) return "none";
  const exceeded: NutrientStatus = options.exceedIsNeutral ? "reached" : "over";
  if (!Number.isFinite(target) || target <= 0) return exceeded;
  const r = consumed / target;
  if (r < STATUS_THRESHOLDS.near) return "under";
  if (r < STATUS_THRESHOLDS.reached) return "near";
  if (r <= STATUS_THRESHOLDS.over) return "reached";
  return exceeded;
}

export type TargetValues = Pick<DailyTargets, "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG">;

export interface ActivityOptions {
  /** Activity kcal counted towards the budget (0 when the user doesn't add activity calories). */
  activityKcal?: number;
}

function activity(options: ActivityOptions): number {
  const a = options.activityKcal ?? 0;
  return Number.isFinite(a) && a > 0 ? a : 0;
}

/** Calorie budget of the day: target + counted activity kcal. */
export function kcalBudget(targets: Pick<DailyTargets, "calories">, options: ActivityOptions = {}): number {
  return targets.calories + activity(options);
}

/**
 * What's left today. Negative values mean "over target" by that amount.
 *   kcal   = target + activityKcal − consumed
 *   macros = target − consumed
 *   fiber  = target − consumed (unknown consumption counts as 0); null without a fiber target
 * Unrounded: round for display only.
 */
export function computeRemaining(
  targets: TargetValues,
  consumed: NutrientTotals,
  options: ActivityOptions = {},
): NutrientRemaining {
  return {
    kcal: kcalBudget(targets, options) - consumed.kcal,
    proteinG: targets.proteinG - consumed.proteinG,
    carbsG: targets.carbsG - consumed.carbsG,
    fatG: targets.fatG - consumed.fatG,
    fiberG: targets.fiberG == null ? null : targets.fiberG - (consumed.fiberG ?? 0),
  };
}

/**
 * Status for every displayed nutrient of a day. kcal is measured against the budget
 * (target + counted activity), protein and fiber use `exceedIsNeutral`.
 */
export function dayNutrientStatus(
  targets: TargetValues,
  consumed: NutrientTotals,
  options: ActivityOptions = {},
): DayNutrientStatus {
  return {
    kcal: macroStatus(consumed.kcal, kcalBudget(targets, options)),
    protein: macroStatus(consumed.proteinG, targets.proteinG, { exceedIsNeutral: true }),
    carbs: macroStatus(consumed.carbsG, targets.carbsG),
    fat: macroStatus(consumed.fatG, targets.fatG),
    fiber:
      targets.fiberG == null
        ? null
        : macroStatus(consumed.fiberG ?? 0, targets.fiberG, { exceedIsNeutral: true }),
  };
}
