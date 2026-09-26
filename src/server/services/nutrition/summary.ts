import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  computeRemaining,
  dayNutrientStatus,
  sumTotals,
  type DailyTargets,
  type DayNutrientStatus,
  type NutrientRemaining,
  type NutrientTotals,
} from "@/domain/nutrition";
import type { ServiceContext } from "@/server/context";
import { activities, mealEntries, meals, userProfiles } from "@/server/db/schema";
import type { IsoDate } from "@/lib/dates";
import { assertIsoDate } from "./dates";
import { getDailyTargets } from "./targets";

/** One logged entry of the day with its nutrient SNAPSHOT (as stored on meal_entries). */
export interface DayEntry {
  id: string;
  mealId: string;
  foodId: string | null;
  recipeId: string | null;
  servingId: string | null;
  foodName: string;
  brandName: string | null;
  servingLabel: string;
  /** Base units (g/ml) of one serving. */
  servingGrams: number;
  quantity: number;
  /** Total base units = servingGrams × quantity. */
  grams: number;
  sortOrder: number;
  loggedAt: Date;
  totals: NutrientTotals;
}

export interface DayMeal {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  /** Archived slots only appear when they hold entries on that day (read-only in the UI). */
  isArchived: boolean;
}

export interface DayMealGroup {
  meal: DayMeal;
  totals: NutrientTotals;
  entries: DayEntry[];
}

export interface DaySummary {
  date: IsoDate;
  /** null when the user has no goal profile yet (onboarding not finished). */
  targets: DailyTargets | null;
  consumed: NutrientTotals;
  /** null without targets. kcal includes `activityKcal`. */
  remaining: NutrientRemaining | null;
  /** Activity kcal counted towards the budget – 0 unless user_profiles.add_activity_calories. */
  activityKcal: number;
  /** null without targets. */
  status: DayNutrientStatus | null;
  /** Active meal slots in sort order, then archived slots that hold entries that day. */
  meals: DayMealGroup[];
  entryCount: number;
}

function entryTotals(e: typeof mealEntries.$inferSelect): NutrientTotals {
  return {
    kcal: e.kcal,
    proteinG: e.proteinG,
    carbsG: e.carbsG,
    fatG: e.fatG,
    fiberG: e.fiberG,
    sugarG: e.sugarG,
    saturatedFatG: e.saturatedFatG,
    sodiumMg: e.sodiumMg,
  };
}

/** SUM(activities.calories_burned) of the day when the user counts activity calories, else 0. */
async function countedActivityKcal(ctx: ServiceContext, date: IsoDate): Promise<number> {
  const [row] = await ctx.db
    .select({
      enabled: userProfiles.addActivityCalories,
      burned: sql<number>`(
        select coalesce(sum(${activities.caloriesBurned}), 0)::float8 from ${activities}
        where ${activities.userId} = ${ctx.userId} and ${activities.date} = ${date}
      )`.mapWith(Number),
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, ctx.userId))
    .limit(1);
  return row?.enabled ? row.burned : 0;
}

/**
 * Everything the "Heute"/diary screen needs for one day, in 4 small queries:
 * targets (snapshot or live), per-meal groups with entries and totals, consumed, remaining, status.
 * Totals are summed in memory with `sumTotals` (same null semantics as SQL SUM) and unrounded.
 */
export async function getDaySummary(ctx: ServiceContext, date: IsoDate): Promise<DaySummary> {
  assertIsoDate(date);
  const [targets, mealRows, entryRows, activityKcal] = await Promise.all([
    getDailyTargets(ctx, date),
    ctx.db
      .select({
        id: meals.id,
        name: meals.name,
        icon: meals.icon,
        sortOrder: meals.sortOrder,
        isArchived: meals.isArchived,
      })
      .from(meals)
      .where(eq(meals.userId, ctx.userId))
      .orderBy(asc(meals.isArchived), asc(meals.sortOrder), asc(meals.createdAt), asc(meals.id)),
    ctx.db
      .select()
      .from(mealEntries)
      .where(and(eq(mealEntries.userId, ctx.userId), eq(mealEntries.date, date)))
      .orderBy(
        asc(mealEntries.sortOrder),
        asc(mealEntries.loggedAt),
        asc(mealEntries.createdAt),
        asc(mealEntries.id),
      ),
    countedActivityKcal(ctx, date),
  ]);

  const byMeal = new Map<string, DayEntry[]>();
  for (const e of entryRows) {
    const entry: DayEntry = {
      id: e.id,
      mealId: e.mealId,
      foodId: e.foodId,
      recipeId: e.recipeId,
      servingId: e.servingId,
      foodName: e.foodName,
      brandName: e.brandName,
      servingLabel: e.servingLabel,
      servingGrams: e.servingGrams,
      quantity: e.quantity,
      grams: e.grams,
      sortOrder: e.sortOrder,
      loggedAt: e.loggedAt,
      totals: entryTotals(e),
    };
    const list = byMeal.get(e.mealId);
    if (list) list.push(entry);
    else byMeal.set(e.mealId, [entry]);
  }

  const groups: DayMealGroup[] = mealRows
    .filter((m) => !m.isArchived || byMeal.has(m.id))
    .map((meal) => {
      const entries = byMeal.get(meal.id) ?? [];
      return { meal, entries, totals: sumTotals(entries.map((e) => e.totals)) };
    });

  const consumed = sumTotals(entryRows.map(entryTotals));
  const activity = { activityKcal };
  return {
    date,
    targets,
    consumed,
    remaining: targets ? computeRemaining(targets, consumed, activity) : null,
    activityKcal,
    status: targets ? dayNutrientStatus(targets, consumed, activity) : null,
    meals: groups,
    entryCount: entryRows.length,
  };
}
