/**
 * Daily Nutrition Engine: server services. See docs/architecture/nutrition-engine.md.
 * Pure math lives in @/domain/nutrition.
 */
export {
  ensureDailyNutrition,
  getDailyTargets,
  refreshTargetsFrom,
  setDayProfile,
  targetsFromProfile,
  targetsFromSnapshot,
} from "./targets";
export { getDaySummary, type DayEntry, type DayMeal, type DayMealGroup, type DaySummary } from "./summary";
export { getDailyTotals, getLoggedDates, type DailyTotalsRow } from "./range";
