import { and, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { pickDayProfile } from "@/domain/macros/schedule";
import type { ServiceContext } from "@/server/context";
import { dailyNutrition, goalProfiles } from "@/server/db/schema";
import { dateRange, isoWeekday, ISO_DATE_RE, type IsoDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";

export type GoalProfileRow = typeof goalProfiles.$inferSelect;

/**
 * CONTRACT: returns the goal profile that applies to
 * `date` for the user, in this precedence:
 *   1. daily_nutrition.goal_profile_id where profile_overridden = true (profile active, i.e. not
 *      archived; an archived/deleted override falls through to 2/3)
 *   2. a non-archived, non-default profile whose `weekdays` contains isoWeekday(date)
 *      (should data ever contain overlaps, the oldest profile wins)
 *   3. the user's default profile
 * Returns null if the user has no goal profile yet (onboarding not finished).
 *
 *   const profile = await resolveGoalProfileForDate(ctx, "2026-09-28"); // Monday → „Trainingstag“
 *
 * Decision logic lives in the pure `pickDayProfile` (src/domain/macros/schedule.ts).
 */
export async function resolveGoalProfileForDate(
  ctx: ServiceContext,
  date: IsoDate,
): Promise<GoalProfileRow | null> {
  assertIsoDate(date);
  const [override] = await ctx.db
    .select({ profile: goalProfiles })
    .from(dailyNutrition)
    .innerJoin(goalProfiles, eq(goalProfiles.id, dailyNutrition.goalProfileId))
    .where(
      and(
        eq(dailyNutrition.userId, ctx.userId),
        eq(dailyNutrition.date, date),
        eq(dailyNutrition.profileOverridden, true),
        eq(goalProfiles.userId, ctx.userId),
        isNull(goalProfiles.archivedAt),
      ),
    )
    .limit(1);
  if (override) return override.profile;

  const weekday = isoWeekday(date);
  const candidates = await ctx.db
    .select()
    .from(goalProfiles)
    .where(
      and(
        eq(goalProfiles.userId, ctx.userId),
        isNull(goalProfiles.archivedAt),
        or(eq(goalProfiles.isDefault, true), sql`${goalProfiles.weekdays} @> array[${weekday}]::smallint[]`),
      ),
    );
  return pickDayProfile(toResolvable(candidates), { weekday })?.row ?? null;
}

/**
 * Batch variant for ranges: one query for
 * profiles, one for overrides. Returns a Map with an entry for every date in [from, to].
 *
 *   const byDate = await resolveGoalProfilesForRange(ctx, "2026-09-28", "2026-10-04");
 *   byDate.get("2026-09-30")?.name // „Ruhetag“
 */
export async function resolveGoalProfilesForRange(
  ctx: ServiceContext,
  from: IsoDate,
  to: IsoDate,
): Promise<Map<IsoDate, GoalProfileRow | null>> {
  assertIsoDate(from);
  assertIsoDate(to);
  const dates = from <= to ? dateRange(from, to) : [];
  if (dates.length > 366 * 2) {
    throw new AppError("VALIDATION", "Der Zeitraum ist zu lang (höchstens 2 Jahre).");
  }
  const result = new Map<IsoDate, GoalProfileRow | null>();
  if (dates.length === 0) return result;

  // Sequential on purpose: ctx.db may be a transaction (one connection).
  const profiles = await ctx.db
    .select()
    .from(goalProfiles)
    .where(and(eq(goalProfiles.userId, ctx.userId), isNull(goalProfiles.archivedAt)));
  const overrides = await ctx.db
    .select({ date: dailyNutrition.date, profileId: dailyNutrition.goalProfileId })
    .from(dailyNutrition)
    .where(
      and(
        eq(dailyNutrition.userId, ctx.userId),
        gte(dailyNutrition.date, from),
        lte(dailyNutrition.date, to),
        eq(dailyNutrition.profileOverridden, true),
        isNotNull(dailyNutrition.goalProfileId),
      ),
    );
  const resolvable = toResolvable(profiles);
  const overrideByDate = new Map(overrides.map((o) => [o.date, o.profileId]));
  for (const date of dates) {
    const picked = pickDayProfile(resolvable, {
      weekday: isoWeekday(date),
      overrideProfileId: overrideByDate.get(date) ?? null,
    });
    result.set(date, picked?.row ?? null);
  }
  return result;
}

function toResolvable(rows: GoalProfileRow[]) {
  return rows.map((row) => ({
    id: row.id,
    isDefault: row.isDefault,
    weekdays: row.weekdays,
    archived: row.archivedAt !== null,
    createdAt: row.createdAt,
    row,
  }));
}

function assertIsoDate(date: IsoDate): void {
  if (!ISO_DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new AppError("VALIDATION", "Ungültiges Datum.", { date: ["Ungültiges Datum."] });
  }
}
