import { addDays, type IsoDate } from "@/lib/dates";
import { DEFAULT_CALCULATOR_ID, getCalculator, isCalculatorId } from "./calculators";
import { computeCalorieTarget, WARNING_MESSAGES } from "./target";
import type { BodyProfile, CalorieCalculation, CalorieWarning, GoalSettings } from "./types";

export interface CalculateCaloriesOptions {
  /**
   * Calculator to use (default Mifflin-St Jeor). Unknown ids fall back to the default silently
   * (stale DB value); a calculator that cannot handle the profile (Katch-McArdle without body fat)
   * falls back to the default with a "calculator_fallback" warning.
   */
  calculatorId?: string | null;
}

/**
 * Main entry point: BMR → TDEE → target for a profile and goal, with graceful calculator fallback.
 * Pure – safe to import in client components for live previews.
 *
 *   calculateCalories(
 *     { ageYears: 33, sex: "male", heightCm: 180, weightKg: 84, activityLevel: "moderate" },
 *     { type: "lose", pace: "moderate", targetWeightKg: 78 },
 *   ) // → { bmr: 1805, tdee: 2797.75, adjustment: −500, target: 2300, estimatedWeeksToGoal: 14, … }
 *
 * Throws CalorieInputError (German message + field) for missing/out-of-range body data.
 */
export function calculateCalories(
  profile: BodyProfile,
  goal: GoalSettings,
  options: CalculateCaloriesOptions = {},
): CalorieCalculation {
  const requestedId = options.calculatorId && isCalculatorId(options.calculatorId) ? options.calculatorId : null;
  let calculator = getCalculator(requestedId ?? DEFAULT_CALCULATOR_ID);
  const warnings: CalorieWarning[] = [];
  if (!calculator.canCalculate(profile)) {
    const fallback = getCalculator(DEFAULT_CALCULATOR_ID);
    warnings.push({
      code: "calculator_fallback",
      message: WARNING_MESSAGES.calculatorFallback(calculator.name, fallback.name),
    });
    calculator = fallback;
  }
  return computeCalorieTarget({
    calculatorId: calculator.id,
    bmr: calculator.calculateBMR(profile),
    profile,
    goal,
    warnings,
  });
}

/** Expected date the target weight is reached ("voraussichtlich am …"), or null. */
export function estimateGoalDate(from: IsoDate, estimatedWeeksToGoal: number | null): IsoDate | null {
  if (estimatedWeeksToGoal == null) return null;
  return addDays(from, estimatedWeeksToGoal * 7);
}
