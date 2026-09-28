import { and, count, eq, gte, sql } from "drizzle-orm";
import type { ServiceContext } from "@/server/context";
import {
  dailyNutrition,
  foods,
  mascotInteractions,
  mealEntries,
  recipes,
  userAchievements,
  userProfiles,
  waterEntries,
  weightEntries,
} from "@/server/db/schema";
import { queryRows } from "@/server/db/sql";
import {
  ACHIEVEMENTS,
  computeStreak,
  consistencyScore,
  evaluateAchievementRules,
  selectMascotMessage,
  type MascotMessage,
  type Streak,
} from "@/domain/engagement";
import { addDays, todayInTimezone } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { getDaySummary, getLoggedDates } from "@/server/services/nutrition";
import { getWeightTrend } from "@/server/services/weight";

export async function getStreak(ctx: ServiceContext): Promise<Streak & { consistency: number }> {
  const today = todayInTimezone(ctx.timezone);
  const dates = await getLoggedDates(ctx, addDays(today, -400), today);
  return { ...computeStreak(dates, today), consistency: consistencyScore(dates, today) };
}

async function gatherFacts(ctx: ServiceContext) {
  const uid = ctx.userId;
  const streak = await getStreak(ctx);
  const [[entries], [custom], [recipeCount], [weights], protein, water] = await Promise.all([
    ctx.db.select({ n: count() }).from(mealEntries).where(eq(mealEntries.userId, uid)),
    ctx.db.select({ n: count() }).from(foods).where(and(eq(foods.ownerUserId, uid), eq(foods.source, "user"))),
    ctx.db.select({ n: count() }).from(recipes).where(eq(recipes.userId, uid)),
    ctx.db.select({ n: count() }).from(weightEntries).where(eq(weightEntries.userId, uid)),
    queryRows<{ n: number }>(
      ctx.db,
      sql`select count(*)::int as n from (
            select e.date from ${mealEntries} e join ${dailyNutrition} d on d.user_id = e.user_id and d.date = e.date
            where e.user_id = ${uid} group by e.date, d.target_protein_g
            having sum(e.protein_g) >= d.target_protein_g) t`,
    ),
    queryRows<{ n: number }>(
      ctx.db,
      sql`select count(*)::int as n from (
            select w.date from ${waterEntries} w join ${userProfiles} p on p.user_id = w.user_id
            where w.user_id = ${uid} group by w.date, p.water_goal_ml having sum(w.amount_ml) >= p.water_goal_ml) t`,
    ),
  ]);
  return {
    totalEntries: entries.n,
    longestStreak: streak.longest,
    customFoods: custom.n,
    recipes: recipeCount.n,
    weightEntries: weights.n,
    proteinGoalDays: protein[0]?.n ?? 0,
    waterGoalDays: water[0]?.n ?? 0,
    consistency: streak.consistency,
  };
}

/** Unlocks newly earned achievements (idempotent). Returns their titles. */
export async function evaluateAchievements(ctx: ServiceContext): Promise<string[]> {
  const facts = await gatherFacts(ctx);
  const have = await ctx.db
    .select({ key: userAchievements.achievementKey })
    .from(userAchievements)
    .where(eq(userAchievements.userId, ctx.userId));
  const fresh = evaluateAchievementRules(facts, new Set(have.map((h) => h.key)));
  if (fresh.length) {
    await ctx.db
      .insert(userAchievements)
      .values(fresh.map((achievementKey) => ({ userId: ctx.userId, achievementKey })))
      .onConflictDoNothing();
  }
  return fresh.map((k) => ACHIEVEMENTS.find((a) => a.key === k)!.title);
}

/** Never lets gamification break the primary action. */
export async function evaluateAchievementsSafe(ctx: ServiceContext): Promise<string[]> {
  try {
    return await evaluateAchievements(ctx);
  } catch (err) {
    logger.warn("achievement evaluation failed", { err: String(err) });
    return [];
  }
}

export async function listAchievements(ctx: ServiceContext) {
  const rows = await ctx.db.select().from(userAchievements).where(eq(userAchievements.userId, ctx.userId));
  const by = new Map(rows.map((r) => [r.achievementKey, r.unlockedAt]));
  return ACHIEVEMENTS.map(({ unlocked: _u, ...a }) => (void _u, { ...a, unlockedAt: by.get(a.key) ?? null }));
}

/** Milo's message for the dashboard, based on today's data. */
export async function getMascotMessage(ctx: ServiceContext): Promise<MascotMessage> {
  const today = todayInTimezone(ctx.timezone);
  const hour = Number(new Intl.DateTimeFormat("de-DE", { hour: "numeric", hourCycle: "h23", timeZone: ctx.timezone }).format(new Date()));
  const [day, streak, [profile], [water], trend, dismissed, newest, [anyEntry]] = await Promise.all([
    getDaySummary(ctx, today),
    getStreak(ctx),
    ctx.db.select().from(userProfiles).where(eq(userProfiles.userId, ctx.userId)),
    ctx.db
      .select({ ml: sql<number>`coalesce(sum(${waterEntries.amountMl}), 0)::int` })
      .from(waterEntries)
      .where(and(eq(waterEntries.userId, ctx.userId), eq(waterEntries.date, today))),
    getWeightTrend(ctx, { from: addDays(today, -30), to: today }).catch(() => null),
    ctx.db
      .select({ key: mascotInteractions.messageKey })
      .from(mascotInteractions)
      .where(and(eq(mascotInteractions.userId, ctx.userId), eq(mascotInteractions.date, today), eq(mascotInteractions.action, "dismissed"))),
    ctx.db
      .select()
      .from(userAchievements)
      .where(and(eq(userAchievements.userId, ctx.userId), gte(userAchievements.unlockedAt, new Date(Date.now() - 12 * 3600_000)))),
    ctx.db.select({ id: mealEntries.id }).from(mealEntries).where(eq(mealEntries.userId, ctx.userId)).limit(1),
  ]);
  const lastWeight = trend?.points.filter((p) => p.weightKg != null).at(-1)?.date ?? null;
  const daysSinceWeight = lastWeight
    ? Math.round((Date.parse(today) - Date.parse(lastWeight)) / 86_400_000)
    : trend && trend.points.some((p) => p.weightKg != null) ? null : 8;
  const achievement = newest[0] ? ACHIEVEMENTS.find((a) => a.key === newest[0].achievementKey)?.title ?? null : null;
  return selectMascotMessage({
    hour,
    isNewUser: !anyEntry,
    entryCount: day.entryCount,
    emptyMeals: day.meals.filter((m) => m.entries.length === 0 && !m.meal.isArchived).map((m) => ({ id: m.meal.id, name: m.meal.name })),
    consumedKcal: day.consumed.kcal,
    targetKcal: day.targets?.calories ?? null,
    proteinG: day.consumed.proteinG,
    proteinTarget: day.targets?.proteinG ?? null,
    waterMl: water?.ml ?? 0,
    waterGoalMl: profile?.waterGoalMl ?? 2500,
    streak,
    weightDirection: (trend?.goal?.direction as "towards" | "away" | "stable" | null | undefined) ?? null,
    daysSinceWeight,
    newAchievement: achievement,
    dismissedKeys: dismissed.map((d) => d.key),
  });
}

export async function dismissMascotMessage(ctx: ServiceContext, key: string): Promise<void> {
  await ctx.db.insert(mascotInteractions).values({
    userId: ctx.userId,
    date: todayInTimezone(ctx.timezone),
    messageKey: key.slice(0, 60),
    action: "dismissed",
  });
}
