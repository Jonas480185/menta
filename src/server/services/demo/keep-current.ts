import { and, eq, lte, max, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { demoShiftDays } from "@/domain/demo/shift";
import type { IsoDate } from "@/lib/dates";
import type { ServiceContext } from "@/server/context";
import {
  activities,
  dailyNutrition,
  mascotInteractions,
  mealEntries,
  waterEntries,
  weightEntries,
} from "@/server/db/schema";

/** Every per-day table of a user. `unique` = one row per (user, date), see shiftTable. */
const DATED_TABLES: { table: PgTable; userId: PgColumn; date: PgColumn; unique: boolean }[] = [
  { table: mealEntries, userId: mealEntries.userId, date: mealEntries.date, unique: false },
  { table: dailyNutrition, userId: dailyNutrition.userId, date: dailyNutrition.date, unique: true },
  { table: weightEntries, userId: weightEntries.userId, date: weightEntries.date, unique: true },
  { table: waterEntries, userId: waterEntries.userId, date: waterEntries.date, unique: false },
  { table: activities, userId: activities.userId, date: activities.date, unique: false },
  { table: mascotInteractions, userId: mascotInteractions.userId, date: mascotInteractions.date, unique: false },
];

/** Far enough to never collide with real dates while a unique (user, date) table is moved. */
const PARK_DAYS = 100_000;

/**
 * Moves the demo account's whole diary forward so its latest logged day (up to `today`)
 * becomes today; entries, weights and goals keep their relative days. Idempotent and safe
 * under concurrency: an advisory lock serializes callers and the gap is measured inside it.
 * Returns the number of days moved (0 = already current).
 */
export async function keepDemoDataCurrent(ctx: ServiceContext, today: IsoDate): Promise<number> {
  return ctx.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`demo-shift:${ctx.userId}`}))`);
    const [{ last }] = await tx
      .select({ last: max(mealEntries.date) })
      .from(mealEntries)
      .where(and(eq(mealEntries.userId, ctx.userId), lte(mealEntries.date, today)));
    const days = demoShiftDays(last, today);
    if (days === 0) return 0;

    for (const { table, userId, date, unique } of DATED_TABLES) {
      const mine = eq(userId, ctx.userId);
      if (unique) {
        // A row-by-row shift could hit the unique (user, date) key mid-statement: park the
        // rows far in the future first, then move them to their final day.
        await tx.update(table).set({ [date.name]: sql`${date} + ${PARK_DAYS + days}::int` }).where(mine);
        await tx.update(table).set({ [date.name]: sql`${date} - ${PARK_DAYS}::int` }).where(mine);
      } else {
        await tx.update(table).set({ [date.name]: sql`${date} + ${days}::int` }).where(mine);
      }
    }
    return days;
  });
}
