/** Weight service. Pure math lives in @/domain/weight. */
export {
  deleteWeight,
  getFirstWeight,
  getLatestWeight,
  getLatestWeightBefore,
  listWeights,
  upsertWeight,
  type UpsertWeightResult,
  type WeightEntry,
} from "./entries";
export {
  getWeightTrend,
  TREND_WARMUP_DAYS,
  type WeightGoalSummary,
  type WeightTrend,
  type WeightTrendInput,
  type WeightTrendPoint,
} from "./trend";
