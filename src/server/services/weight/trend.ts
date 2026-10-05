import "server-only";
import { and, count, eq, lte } from "drizzle-orm";
import {
  goalProgress,
  movingAverage7,
  projectGoalDate,
  trendDirectionRelativeToGoal,
  trendSeries,
  weeklyRate as computeWeeklyRate,
  weightChange,
  weightRangeSchema,
  type GoalProgress,
  type TrendDirection,
  type WeightGoalDirection,
  type WeightTrendPoint,
} from "@/domain/weight";
import { addDays, dateRange, todayInTimezone, type IsoDate } from "@/lib/dates";
import type { ServiceContext } from "@/server/context";
import { weightEntries } from "@/server/db/schema";
import { getProfile } from "@/server/services/profile";
import { getFirstWeight, getLatestWeightBefore, listWeights, type WeightEntry } from "./entries";

/**
 * Days loaded before `from` so the exponential trend (alpha 0.1: 0.9^60 ≈ 0.2 %) and the
 * 30-day change are already settled at the first visible day.
 */
export const TREND_WARMUP_DAYS = 60;

export type { WeightTrendPoint };

export interface WeightGoalSummary {
  targetKg: number;
  /** Weight the progress is measured from (profile start weight, else the first entry). */
  startKg: number;
  goalType: WeightGoalDirection | null;
  progress: GoalProgress;
  /** Projected day the trend reaches the target, null when flat/away/reached/too far. */
  projectedDate: IsoDate | null;
  direction: TrendDirection;
}

export interface WeightTrend {
  from: IsoDate;
  to: IsoDate;
  points: WeightTrendPoint[];
  /** Latest entry on or before `to`. */
  current: { date: IsoDate; weightKg: number } | null;
  /** Trend value on the last day (≤ to, ≤ today). */
  trendCurrent: number | null;
  /** Trend change over 7 / 30 days (kg, negative = decreasing). */
  change7d: number | null;
  change30d: number | null;
  /** kg/week from the last 14-28 days of the trend, null with too little data. */
  weeklyRate: number | null;
  goal: WeightGoalSummary | null;
  /** Number of entries up to `to` (all time): < 3 → UI shows no trend line yet. */
  entryCount: number;
  firstEntryDate: IsoDate | null;
}

export interface WeightTrendInput {
  /** Default: the first entry (or `to` without entries). */
  from?: IsoDate;
  /** Default: the user's today. */
  to?: IsoDate;
}

/**
 * Everything the weight screen, the dashboard card and analytics need for a date range:
 * per-day points (raw, 7-day average, trend) plus current/trend values, changes, weekly rate
 * and goal progress/projection. Loads a warm-up window before `from`.
 */
export async function getWeightTrend(
  ctx: ServiceContext,
  input: WeightTrendInput = {},
): Promise<WeightTrend> {
  const parsed = weightRangeSchema.parse(input);
  const today = todayInTimezone(ctx.timezone);
  const to = parsed.to ?? today;

  const [first, profile] = await Promise.all([getFirstWeight(ctx), getProfile(ctx)]);
  const from = parsed.from ?? (first && first.date < to ? first.date : to);

  // Entries of the warm-up window + range, and the all-time count for the "< 3 entries" rule.
  const windowStart = addDays(from, -TREND_WARMUP_DAYS);
  const entries = await listWeights(ctx, { from: windowStart, to });
  if (first && first.date < windowStart) {
    // Seed the trend with the last entry before the window (long logging breaks).
    const seed = await getLatestWeightBefore(ctx, windowStart);
    if (seed) entries.unshift(seed);
  }
  const entryCount = first ? await countUntil(ctx, to, entries, first) : 0;

  const trendUntil = to < today ? to : today;
  const trend = trendSeries(entries, { until: trendUntil });
  const trendByDate = new Map(trend.map((p) => [p.date, p.value]));
  const weightByDate = new Map(entries.map((e) => [e.date, e.weightKg]));

  const days = dateRange(from, to);
  const avg = movingAverage7(entries, days);
  const points: WeightTrendPoint[] = days.map((date, i) => ({
    date,
    weightKg: weightByDate.get(date) ?? null,
    avg7: avg[i].value,
    trend: date <= trendUntil ? (trendByDate.get(date) ?? null) : null,
  }));

  const latest: WeightEntry | undefined = entries[entries.length - 1];
  const trendCurrent = trend.length > 0 ? trend[trend.length - 1].value : null;
  const measuredTrend = trend.filter((p) => weightByDate.has(p.date));
  const rate = computeWeeklyRate(measuredTrend);

  let goal: WeightGoalSummary | null = null;
  const startKg = profile.startWeightKg ?? first?.weightKg ?? null;
  const targetKg = profile.targetWeightKg ?? (profile.goalType === "maintain" ? startKg : null);
  const currentForGoal = trendCurrent ?? latest?.weightKg ?? null;
  if (targetKg != null && startKg != null && currentForGoal != null) {
    goal = {
      targetKg,
      startKg,
      goalType: profile.goalType ?? null,
      progress: goalProgress({
        start: startKg,
        current: currentForGoal,
        target: targetKg,
        goalType: profile.goalType,
      }),
      projectedDate: projectGoalDate({ current: currentForGoal, target: targetKg, weeklyRate: rate, today }),
      direction: trendDirectionRelativeToGoal({
        weeklyRate: rate,
        current: currentForGoal,
        target: targetKg,
        goalType: profile.goalType,
      }),
    };
  }

  return {
    from,
    to,
    points,
    current: latest ? { date: latest.date, weightKg: latest.weightKg } : null,
    trendCurrent,
    change7d: weightChange(trend, 7),
    change30d: weightChange(trend, 30),
    weeklyRate: rate,
    goal,
    entryCount,
    firstEntryDate: first?.date ?? null,
  };
}

/** All-time entry count up to `to`; skips the query when the loaded window already starts at the first entry. */
async function countUntil(
  ctx: ServiceContext,
  to: IsoDate,
  loaded: WeightEntry[],
  first: WeightEntry,
): Promise<number> {
  if (loaded.length > 0 && loaded[0].date === first.date) return loaded.length;
  const [row] = await ctx.db
    .select({ n: count() })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, ctx.userId), lte(weightEntries.date, to)));
  return row?.n ?? 0;
}
