import "server-only";
import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm";
import {
  weightEntryInputSchema,
  weightRangeSchema,
  isoDateSchema,
  type WeightEntryInput,
} from "@/domain/weight";
import { todayInTimezone, type IsoDate } from "@/lib/dates";
import { notFound, validationError } from "@/lib/errors";
import type { ServiceContext } from "@/server/context";
import { inTransaction } from "@/server/context";
import { weightEntries } from "@/server/db/schema";

/** Serializable weight entry (safe to pass to client components). */
export interface WeightEntry {
  id: string;
  date: IsoDate;
  weightKg: number;
  bodyFatPct: number | null;
  note: string | null;
  source: string;
}

const columns = {
  id: weightEntries.id,
  date: weightEntries.date,
  weightKg: weightEntries.weightKg,
  bodyFatPct: weightEntries.bodyFatPct,
  note: weightEntries.note,
  source: weightEntries.source,
};

export interface UpsertWeightResult {
  entry: WeightEntry;
  /** The entry this one replaced (same day), for "replaced" feedback and undo. */
  previous: WeightEntry | null;
}

/**
 * Logs the weight of one day – one entry per user and day; a second entry for the same day
 * replaces the first. Dates in the future (user's timezone) are rejected.
 */
export async function upsertWeight(
  ctx: ServiceContext,
  input: WeightEntryInput,
): Promise<UpsertWeightResult> {
  const data = weightEntryInputSchema.parse(input);
  if (data.date > todayInTimezone(ctx.timezone)) {
    throw validationError({ date: ["Das Datum liegt in der Zukunft."] });
  }

  return inTransaction(ctx, async (tx) => {
    const [previous] = await tx.db
      .select(columns)
      .from(weightEntries)
      .where(and(eq(weightEntries.userId, ctx.userId), eq(weightEntries.date, data.date)))
      .limit(1);

    const values = {
      weightKg: data.weightKg,
      bodyFatPct: data.bodyFatPct ?? null,
      note: data.note,
      source: "manual",
    };
    const [entry] = await tx.db
      .insert(weightEntries)
      .values({ userId: ctx.userId, date: data.date, ...values })
      .onConflictDoUpdate({
        target: [weightEntries.userId, weightEntries.date],
        set: { ...values, updatedAt: new Date() },
      })
      .returning(columns);

    return { entry, previous: previous ?? null };
  });
}

/** Deletes the entry of `date` and returns it (for undo). NOT_FOUND when there is none. */
export async function deleteWeight(ctx: ServiceContext, date: IsoDate): Promise<WeightEntry> {
  const day = isoDateSchema.parse(date);
  const [deleted] = await ctx.db
    .delete(weightEntries)
    .where(and(eq(weightEntries.userId, ctx.userId), eq(weightEntries.date, day)))
    .returning(columns);
  if (!deleted) throw notFound("Gewichtseintrag");
  return deleted;
}

/** Entries in [from, to] (both optional, inclusive), oldest first. */
export async function listWeights(
  ctx: ServiceContext,
  range: { from?: IsoDate; to?: IsoDate } = {},
): Promise<WeightEntry[]> {
  const { from, to } = weightRangeSchema.parse(range);
  return ctx.db
    .select(columns)
    .from(weightEntries)
    .where(
      and(
        eq(weightEntries.userId, ctx.userId),
        from ? gte(weightEntries.date, from) : undefined,
        to ? lte(weightEntries.date, to) : undefined,
      ),
    )
    .orderBy(asc(weightEntries.date));
}

/** Latest entry on or before the user's today, or null. */
export async function getLatestWeight(ctx: ServiceContext): Promise<WeightEntry | null> {
  const [row] = await ctx.db
    .select(columns)
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, ctx.userId), lte(weightEntries.date, todayInTimezone(ctx.timezone))))
    .orderBy(desc(weightEntries.date))
    .limit(1);
  return row ?? null;
}

/** Oldest entry, or null – e.g. to resolve the "Alle" range or a fallback start weight. */
export async function getFirstWeight(ctx: ServiceContext): Promise<WeightEntry | null> {
  const [row] = await ctx.db
    .select(columns)
    .from(weightEntries)
    .where(eq(weightEntries.userId, ctx.userId))
    .orderBy(asc(weightEntries.date))
    .limit(1);
  return row ?? null;
}

/** Latest entry strictly before `date`, or null. */
export async function getLatestWeightBefore(ctx: ServiceContext, date: IsoDate): Promise<WeightEntry | null> {
  const [row] = await ctx.db
    .select(columns)
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, ctx.userId), lt(weightEntries.date, date)))
    .orderBy(desc(weightEntries.date))
    .limit(1);
  return row ?? null;
}
