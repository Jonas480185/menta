import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { SetDailyStepsSchema } from "@/domain/activity";
import type { IsoDate } from "@/lib/dates";
import type { ServiceContext } from "@/server/context";
import { activities } from "@/server/db/schema";
import { parseInput } from "./internal";

/** externalId of the single manual steps row per day – makes the upsert use the partial unique index. */
export function manualStepsExternalId(date: IsoDate): string {
  return `manual-steps:${date}`;
}

/**
 * Sets the manually entered steps of a day (one manual steps row per user and day, upserted).
 * `steps = 0` removes the row. Steps rows carry no calories: everyday walking is part of the activity
 * level in the TDEE (see docs/architecture/activity-integrations.md).
 */
export async function setDailySteps(
  ctx: ServiceContext,
  date: IsoDate,
  steps: number,
): Promise<{ date: IsoDate; steps: number }> {
  const data = parseInput(SetDailyStepsSchema, { date, steps });
  const externalId = manualStepsExternalId(data.date);

  if (data.steps === 0) {
    await ctx.db
      .delete(activities)
      .where(
        and(
          eq(activities.userId, ctx.userId),
          eq(activities.source, "manual"),
          eq(activities.externalId, externalId),
        ),
      );
    return { date: data.date, steps: 0 };
  }

  await ctx.db
    .insert(activities)
    .values({
      userId: ctx.userId,
      date: data.date,
      type: "steps",
      name: "Schritte",
      steps: data.steps,
      source: "manual",
      externalId,
    })
    .onConflictDoUpdate({
      target: [activities.userId, activities.source, activities.externalId],
      targetWhere: sql`${activities.externalId} is not null`,
      set: { steps: data.steps, updatedAt: new Date() },
    });
  return { date: data.date, steps: data.steps };
}
