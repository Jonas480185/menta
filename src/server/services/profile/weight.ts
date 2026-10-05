import "server-only";
import { and, desc, eq, isNotNull, lte } from "drizzle-orm";
import { todayInTimezone, type IsoDate } from "@/lib/dates";
import type { ServiceContext } from "@/server/context";
import { userProfiles, weightEntries } from "@/server/db/schema";

export interface CurrentWeight {
  weightKg: number;
  /** "entry" = latest weight_entries row, "start" = user_profiles.start_weight_kg (no entries yet). */
  source: "entry" | "start";
  /** Date of the weight entry; null for the start weight. */
  date: IsoDate | null;
  /** Latest logged body fat % (may be from an older entry than the weight), else null. */
  bodyFatPct: number | null;
}

/**
 * Current weight for calculations: the latest weight entry on or before the user's today,
 * otherwise the onboarding start weight. Null when neither exists. Read-only.
 */
export async function getCurrentWeight(ctx: ServiceContext): Promise<CurrentWeight | null> {
  const today = todayInTimezone(ctx.timezone);
  const mine = and(eq(weightEntries.userId, ctx.userId), lte(weightEntries.date, today));

  const [latest] = await ctx.db
    .select({ weightKg: weightEntries.weightKg, date: weightEntries.date, bodyFatPct: weightEntries.bodyFatPct })
    .from(weightEntries)
    .where(mine)
    .orderBy(desc(weightEntries.date))
    .limit(1);

  let bodyFatPct = latest?.bodyFatPct ?? null;
  if (latest && bodyFatPct == null) {
    const [fat] = await ctx.db
      .select({ bodyFatPct: weightEntries.bodyFatPct })
      .from(weightEntries)
      .where(and(mine, isNotNull(weightEntries.bodyFatPct)))
      .orderBy(desc(weightEntries.date))
      .limit(1);
    bodyFatPct = fat?.bodyFatPct ?? null;
  }
  if (latest) return { weightKg: latest.weightKg, source: "entry", date: latest.date, bodyFatPct };

  const [profile] = await ctx.db
    .select({ startWeightKg: userProfiles.startWeightKg })
    .from(userProfiles)
    .where(eq(userProfiles.userId, ctx.userId))
    .limit(1);
  if (profile?.startWeightKg == null) return null;
  return { weightKg: profile.startWeightKg, source: "start", date: null, bodyFatPct: null };
}

/** Shorthand for getCurrentWeight(ctx)?.weightKg: latest entry, else start weight, else null. */
export async function getCurrentWeightKg(ctx: ServiceContext): Promise<number | null> {
  return (await getCurrentWeight(ctx))?.weightKg ?? null;
}
