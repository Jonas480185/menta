import "server-only";
import { and, asc, eq, gte, isNull } from "drizzle-orm";
import type { DailyTargets } from "@/domain/nutrition";
import { inTransaction, type ServiceContext } from "@/server/context";
import { dailyNutrition, goalProfiles } from "@/server/db/schema";
import { resolveGoalProfileForDate, type GoalProfileRow } from "@/server/services/goals/resolve";
import { notFound } from "@/lib/errors";
import type { IsoDate } from "@/lib/dates";
import { assertIsoDate, todayFor } from "./dates";

/**
 * Daily targets & the `daily_nutrition` snapshot (Daily Nutrition Engine).
 *
 * Snapshot rules (docs/architecture/nutrition-engine.md):
 * - Past days (date < today in ctx.timezone) with a snapshot row are FROZEN: goal changes never
 *   rewrite history. Only an explicit `setDayProfile` for that date changes them.
 * - Today/future: targets are LIVE, the explicitly chosen profile (profile_overridden and the profile
 *   still exists), else `resolveGoalProfileForDate` (weekday schedule → default).
 * - The snapshot row is written by `ensureDailyNutrition` (logging), `setDayProfile` and refreshed by
 *   `refreshTargetsFrom` (goal changes), so it always equals the live targets while the day is current.
 */

type DailyNutritionRow = typeof dailyNutrition.$inferSelect;

interface LoadedDay {
  day: DailyNutritionRow;
  /** Joined profile of goal_profile_id (null when unset or deleted). */
  profile: GoalProfileRow | null;
}

/** The profile's targets as DailyTargets. */
export function targetsFromProfile(p: GoalProfileRow): DailyTargets {
  return {
    calories: p.calorieTarget,
    proteinG: p.proteinG,
    carbsG: p.carbsG,
    fatG: p.fatG,
    fiberG: p.fiberG,
    goalProfileId: p.id,
    goalProfileName: p.name,
  };
}

/** The frozen targets of a daily_nutrition row. */
export function targetsFromSnapshot(row: DailyNutritionRow, profileName: string | null): DailyTargets {
  return {
    calories: row.targetCalories,
    proteinG: row.targetProteinG,
    carbsG: row.targetCarbsG,
    fatG: row.targetFatG,
    fiberG: row.targetFiberG,
    goalProfileId: row.goalProfileId,
    goalProfileName: profileName,
  };
}

async function loadDay(ctx: ServiceContext, date: IsoDate): Promise<LoadedDay | null> {
  const [row] = await ctx.db
    .select({ day: dailyNutrition, profile: goalProfiles })
    .from(dailyNutrition)
    .leftJoin(
      goalProfiles,
      and(eq(goalProfiles.id, dailyNutrition.goalProfileId), eq(goalProfiles.userId, ctx.userId)),
    )
    .where(and(eq(dailyNutrition.userId, ctx.userId), eq(dailyNutrition.date, date)))
    .limit(1);
  return row ?? null;
}

interface LiveTargets {
  targets: DailyTargets;
  profileOverridden: boolean;
}

/**
 * Live targets for a day: explicit override (if its profile still exists), else the resolved profile.
 * "Overridden but profile deleted" is treated like "not overridden" (schema contract).
 */
async function liveTargets(
  ctx: ServiceContext,
  date: IsoDate,
  loaded: LoadedDay | null,
): Promise<LiveTargets | null> {
  if (loaded?.day.profileOverridden && loaded.profile) {
    return { targets: targetsFromProfile(loaded.profile), profileOverridden: true };
  }
  const resolved = await resolveGoalProfileForDate(ctx, date);
  return resolved ? { targets: targetsFromProfile(resolved), profileOverridden: false } : null;
}

function snapshotValues(live: LiveTargets) {
  const t = live.targets;
  return {
    goalProfileId: t.goalProfileId,
    profileOverridden: live.profileOverridden,
    targetCalories: t.calories,
    targetProteinG: t.proteinG,
    targetCarbsG: t.carbsG,
    targetFatG: t.fatG,
    targetFiberG: t.fiberG,
  };
}

function sameSnapshot(row: DailyNutritionRow, v: ReturnType<typeof snapshotValues>): boolean {
  return (
    row.goalProfileId === v.goalProfileId &&
    row.profileOverridden === v.profileOverridden &&
    row.targetCalories === v.targetCalories &&
    row.targetProteinG === v.targetProteinG &&
    row.targetCarbsG === v.targetCarbsG &&
    row.targetFatG === v.targetFatG &&
    row.targetFiberG === v.targetFiberG
  );
}

/**
 * Targets that apply to `date` for the user, or null when the user has no goal profile yet.
 * - date < today and a snapshot exists → the frozen snapshot.
 * - otherwise → live targets (override → resolved profile); a snapshot is the last fallback when no
 *   profile can be resolved any more.
 * Read-only: never writes.
 */
export async function getDailyTargets(ctx: ServiceContext, date: IsoDate): Promise<DailyTargets | null> {
  assertIsoDate(date);
  const loaded = await loadDay(ctx, date);
  if (loaded && date < todayFor(ctx)) return targetsFromSnapshot(loaded.day, loaded.profile?.name ?? null);
  const live = await liveTargets(ctx, date, loaded);
  if (live) return live.targets;
  return loaded ? targetsFromSnapshot(loaded.day, loaded.profile?.name ?? null) : null;
}

/**
 * Idempotently makes sure `daily_nutrition` holds the day's target snapshot. Meal Logging calls this
 * whenever an entry is added/moved to a date (inside its transaction is fine).
 * - Past day with snapshot → untouched.
 * - Past day without snapshot → inserted with today's best knowledge (the live targets), then frozen.
 * - Today/future → inserted or refreshed to the live targets (no write when unchanged).
 * Returns the day's targets; null (and no row) when the user has no goal profile.
 */
export async function ensureDailyNutrition(ctx: ServiceContext, date: IsoDate): Promise<DailyTargets | null> {
  assertIsoDate(date);
  const isPast = date < todayFor(ctx);
  const loaded = await loadDay(ctx, date);
  if (loaded && isPast) return targetsFromSnapshot(loaded.day, loaded.profile?.name ?? null);

  const live = await liveTargets(ctx, date, loaded);
  if (!live) return loaded ? targetsFromSnapshot(loaded.day, loaded.profile?.name ?? null) : null;

  const values = snapshotValues(live);
  if (loaded && sameSnapshot(loaded.day, values)) return live.targets;

  const insert = ctx.db.insert(dailyNutrition).values({ userId: ctx.userId, date, ...values });
  if (isPast) {
    // A concurrent writer may have created the row in the meantime: its snapshot wins.
    await insert.onConflictDoNothing({ target: [dailyNutrition.userId, dailyNutrition.date] });
  } else {
    await insert.onConflictDoUpdate({ target: [dailyNutrition.userId, dailyNutrition.date], set: values });
  }
  return live.targets;
}

/**
 * Re-snapshots every existing `daily_nutrition` row from `fromDate` on (clamped to today: past days
 * stay frozen) to the live targets. Goal/Macro services call this after a profile was created,
 * edited, archived, re-scheduled or the default changed: `await refreshTargetsFrom(ctx)`.
 * Days without a row need nothing: their targets are resolved live on read.
 * Returns the number of rows that changed.
 */
export async function refreshTargetsFrom(
  ctx: ServiceContext,
  fromDate?: IsoDate,
): Promise<{ updated: number }> {
  const today = todayFor(ctx);
  if (fromDate !== undefined) assertIsoDate(fromDate);
  const from = fromDate !== undefined && fromDate > today ? fromDate : today;

  const rows: LoadedDay[] = await ctx.db
    .select({ day: dailyNutrition, profile: goalProfiles })
    .from(dailyNutrition)
    .leftJoin(
      goalProfiles,
      and(eq(goalProfiles.id, dailyNutrition.goalProfileId), eq(goalProfiles.userId, ctx.userId)),
    )
    .where(and(eq(dailyNutrition.userId, ctx.userId), gte(dailyNutrition.date, from)))
    .orderBy(asc(dailyNutrition.date));

  let updated = 0;
  for (const row of rows) {
    const live = await liveTargets(ctx, row.day.date, row);
    if (!live) continue; // no profile left: keep the last known targets
    const values = snapshotValues(live);
    if (sameSnapshot(row.day, values)) continue;
    await ctx.db
      .update(dailyNutrition)
      .set(values)
      .where(and(eq(dailyNutrition.userId, ctx.userId), eq(dailyNutrition.date, row.day.date)));
    updated++;
  }
  return { updated };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Explicitly assigns a goal profile to one date ("Heute ist Trainingstag"), or clears the assignment
 * with `null` (back to the weekday schedule/default). Works for past dates too: an explicit choice by
 * the user is the one way to change a frozen day.
 *
 * @throws AppError NOT_FOUND when the profile doesn't exist, is archived or belongs to someone else.
 * Returns the resulting targets of the day (null only when clearing and the user has no profile).
 */
export async function setDayProfile(
  ctx: ServiceContext,
  date: IsoDate,
  goalProfileId: string | null,
): Promise<DailyTargets | null> {
  assertIsoDate(date);

  if (goalProfileId !== null) {
    if (!UUID_RE.test(goalProfileId)) throw notFound("Zielprofil");
    const [profile] = await ctx.db
      .select()
      .from(goalProfiles)
      .where(
        and(
          eq(goalProfiles.id, goalProfileId),
          eq(goalProfiles.userId, ctx.userId),
          isNull(goalProfiles.archivedAt),
        ),
      )
      .limit(1);
    if (!profile) throw notFound("Zielprofil");
    const live: LiveTargets = { targets: targetsFromProfile(profile), profileOverridden: true };
    const values = snapshotValues(live);
    await ctx.db
      .insert(dailyNutrition)
      .values({ userId: ctx.userId, date, ...values })
      .onConflictDoUpdate({ target: [dailyNutrition.userId, dailyNutrition.date], set: values });
    return live.targets;
  }

  return inTransaction(ctx, async (tx) => {
    const cleared = await tx.db
      .update(dailyNutrition)
      .set({ profileOverridden: false })
      .where(and(eq(dailyNutrition.userId, tx.userId), eq(dailyNutrition.date, date)))
      .returning();
    const row = cleared[0];
    // No row → nothing was assigned; targets are resolved live.
    if (!row) return getDailyTargets(tx, date);

    // Re-snapshot with what applies without the override (also for past days: the user asked for it).
    const resolved = await resolveGoalProfileForDate(tx, date);
    if (!resolved) return targetsFromSnapshot(row, null);
    const values = snapshotValues({ targets: targetsFromProfile(resolved), profileOverridden: false });
    await tx.db
      .update(dailyNutrition)
      .set(values)
      .where(and(eq(dailyNutrition.userId, tx.userId), eq(dailyNutrition.date, date)));
    return targetsFromProfile(resolved);
  });
}
