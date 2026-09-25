import { and, eq, isNull } from "drizzle-orm";
import type { ServiceContext } from "@/server/context";
import { goalProfiles } from "@/server/db/schema";
import type { IsoDate } from "@/lib/dates";

export type GoalProfileRow = typeof goalProfiles.$inferSelect;

/**
 * CONTRACT: returns the goal profile that applies to
 * `date` for the user, in this precedence:
 *   1. daily_nutrition.goal_profile_id where profile_overridden = true
 *   2. a non-archived profile whose `weekdays` contains isoWeekday(date)
 *   3. the user's default profile
 * Returns null if the user has no goal profile yet (onboarding not finished).
 *
 * FOUNDATION STUB: only implements step 3. Macro Engine replaces the body; the signature is fixed.
 */
export async function resolveGoalProfileForDate(
  ctx: ServiceContext,
  date: IsoDate,
): Promise<GoalProfileRow | null> {
  void date;
  const [row] = await ctx.db
    .select()
    .from(goalProfiles)
    .where(
      and(
        eq(goalProfiles.userId, ctx.userId),
        eq(goalProfiles.isDefault, true),
        isNull(goalProfiles.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}
