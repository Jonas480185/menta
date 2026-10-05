import "server-only";
import { and, asc, between, eq, sql, type AnyColumn } from "drizzle-orm";
import type { DailyTargets, NutrientTotals } from "@/domain/nutrition";
import type { ServiceContext } from "@/server/context";
import { dailyNutrition, goalProfiles, mealEntries } from "@/server/db/schema";
import type { IsoDate } from "@/lib/dates";
import { assertIsoDate } from "./dates";

export interface DailyTotalsRow {
  date: IsoDate;
  totals: NutrientTotals;
  entryCount: number;
  /**
   * The day's target SNAPSHOT (daily_nutrition), null when the day has none (entries logged without
   * `ensureDailyNutrition`). Use `getDailyTargets` for a single day's live targets.
   */
  targets: DailyTargets | null;
}

/** SUM of a double column as number (SQL SUM over double precision is already float8). */
const sumOf = (col: AnyColumn) => sql<number>`coalesce(sum(${col}), 0)`.mapWith(Number);
/** SUM of an optional nutrient: sum of known values, NULL only if all are NULL, like `sumTotals`. */
const sumOptional = (col: AnyColumn) => sql<number | null>`sum(${col})`.mapWith(Number);

/**
 * Per-day consumed totals + target snapshot for every LOGGED day (≥ 1 entry) in [from, to], ascending.
 * One GROUP BY over the (user_id, date) index: a year of data is a single fast query.
 * Days without entries are omitted (they are "not logged", not "0 kcal").
 */
export async function getDailyTotals(
  ctx: ServiceContext,
  from: IsoDate,
  to: IsoDate,
): Promise<DailyTotalsRow[]> {
  assertIsoDate(from, "from");
  assertIsoDate(to, "to");
  if (from > to) return [];

  const rows = await ctx.db
    .select({
      date: mealEntries.date,
      entryCount: sql<number>`count(*)::int`.mapWith(Number),
      kcal: sumOf(mealEntries.kcal),
      proteinG: sumOf(mealEntries.proteinG),
      carbsG: sumOf(mealEntries.carbsG),
      fatG: sumOf(mealEntries.fatG),
      fiberG: sumOptional(mealEntries.fiberG),
      sugarG: sumOptional(mealEntries.sugarG),
      saturatedFatG: sumOptional(mealEntries.saturatedFatG),
      sodiumMg: sumOptional(mealEntries.sodiumMg),
      targetCalories: dailyNutrition.targetCalories,
      targetProteinG: dailyNutrition.targetProteinG,
      targetCarbsG: dailyNutrition.targetCarbsG,
      targetFatG: dailyNutrition.targetFatG,
      targetFiberG: dailyNutrition.targetFiberG,
      goalProfileId: dailyNutrition.goalProfileId,
      goalProfileName: goalProfiles.name,
    })
    .from(mealEntries)
    .leftJoin(
      dailyNutrition,
      and(eq(dailyNutrition.userId, mealEntries.userId), eq(dailyNutrition.date, mealEntries.date)),
    )
    .leftJoin(goalProfiles, eq(goalProfiles.id, dailyNutrition.goalProfileId))
    .where(and(eq(mealEntries.userId, ctx.userId), between(mealEntries.date, from, to)))
    // daily_nutrition's PK (user_id, date) and goal_profiles.id functionally determine the selected columns.
    .groupBy(mealEntries.date, dailyNutrition.userId, dailyNutrition.date, goalProfiles.id)
    .orderBy(asc(mealEntries.date));

  return rows.map((r) => ({
    date: r.date,
    entryCount: r.entryCount,
    totals: {
      kcal: r.kcal,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatG: r.fatG,
      fiberG: r.fiberG,
      sugarG: r.sugarG,
      saturatedFatG: r.saturatedFatG,
      sodiumMg: r.sodiumMg,
    },
    targets:
      r.targetCalories == null || r.targetProteinG == null || r.targetCarbsG == null || r.targetFatG == null
        ? null
        : {
            calories: r.targetCalories,
            proteinG: r.targetProteinG,
            carbsG: r.targetCarbsG,
            fatG: r.targetFatG,
            fiberG: r.targetFiberG,
            goalProfileId: r.goalProfileId,
            goalProfileName: r.goalProfileName,
          },
  }));
}

/** Distinct dates in [from, to] with at least one entry, ascending (calendar dots, streaks). */
export async function getLoggedDates(ctx: ServiceContext, from: IsoDate, to: IsoDate): Promise<IsoDate[]> {
  assertIsoDate(from, "from");
  assertIsoDate(to, "to");
  if (from > to) return [];
  const rows = await ctx.db
    .selectDistinct({ date: mealEntries.date })
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, ctx.userId), between(mealEntries.date, from, to)))
    .orderBy(asc(mealEntries.date));
  return rows.map((r) => r.date);
}
