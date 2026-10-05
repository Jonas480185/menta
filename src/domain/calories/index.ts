/**
 * Calorie Engine: pure, framework-free. Safe for server and client components.
 * Docs: docs/architecture/calorie-engine.md
 */
export * from "./types";
export * from "./constants";
export * from "./errors";
export { calculateAge } from "./age";
export {
  CALCULATORS,
  DEFAULT_CALCULATOR_ID,
  defineCalculator,
  getCalculator,
  harrisBenedictRevised,
  isCalculatorId,
  katchMcArdle,
  mifflinStJeor,
  type CalculatorDefinition,
} from "./calculators";
export {
  computeCalorieTarget,
  requestedAdjustmentKcal,
  resolveGoalPace,
  safetyFloorKcal,
  validateBodyProfile,
  weeklyChangeKgFor,
  type ComputeTargetInput,
} from "./target";
export { calculateCalories, estimateGoalDate, type CalculateCaloriesOptions } from "./calculate";
export {
  describeCalorieCalculation,
  type CalorieBreakdown,
  type CalorieBreakdownKey,
  type CalorieBreakdownLine,
} from "./breakdown";
export { checkManualTarget, MANUAL_TARGET_LIMITS, type ManualTargetCheck } from "./manual";
export * from "./schemas";
