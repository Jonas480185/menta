/** Calorie service. Pure math lives in @/domain/calories. Docs: docs/architecture/calorie-engine.md */
export {
  calculateCaloriesForUser,
  recalculateAndStore,
  type CalorieOverrides,
  type UserCalorieCalculation,
} from "./calculate";
