import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { AddWaterSchema, IdSchema, IsoDateSchema, WaterGoalSchema } from "@/domain/activity";
import { notFound } from "@/lib/errors";
import type { IsoDate } from "@/lib/dates";
import type { ServiceContext } from "@/server/context";
import { waterEntries } from "@/server/db/schema";
import { getProfile, updateProfile } from "@/server/services/profile";
import { parseInput } from "@/server/services/activity/internal";

/** Serializable water entry. */
export interface WaterEntry {
  id: string;
  date: IsoDate;
  amountMl: number;
  /** ISO timestamp. */
  loggedAt: string;
}

export interface WaterSummary {
  date: IsoDate;
  totalMl: number;
  goalMl: number;
  /** Oldest first. */
  entries: WaterEntry[];
}

function toWaterEntry(row: typeof waterEntries.$inferSelect): WaterEntry {
  return { id: row.id, date: row.date, amountMl: row.amountMl, loggedAt: row.loggedAt.toISOString() };
}

/**
 * Logs water for a day (1-5,000 ml per entry). `loggedAt` defaults to now; pass the original
 * timestamp to restore a deleted entry (undo).
 */
export async function addWater(
  ctx: ServiceContext,
  date: IsoDate,
  amountMl: number,
  options: { loggedAt?: Date } = {},
): Promise<WaterEntry> {
  const data = parseInput(AddWaterSchema, { date, amountMl });
  const [row] = await ctx.db
    .insert(waterEntries)
    .values({ userId: ctx.userId, date: data.date, amountMl: data.amountMl, loggedAt: options.loggedAt })
    .returning();
  return toWaterEntry(row);
}

/** Deletes one of the user's water entries; returns it (for undo). */
export async function deleteWater(ctx: ServiceContext, id: string): Promise<WaterEntry> {
  const data = parseInput(IdSchema, { id });
  const [row] = await ctx.db
    .delete(waterEntries)
    .where(and(eq(waterEntries.id, data.id), eq(waterEntries.userId, ctx.userId)))
    .returning();
  if (!row) throw notFound("Wassereintrag");
  return toWaterEntry(row);
}

/** Total, goal and entries of a day. */
export async function getWaterSummary(ctx: ServiceContext, date: IsoDate): Promise<WaterSummary> {
  const day = parseInput(IsoDateSchema, date);
  const [rows, profile] = await Promise.all([
    ctx.db
      .select()
      .from(waterEntries)
      .where(and(eq(waterEntries.userId, ctx.userId), eq(waterEntries.date, day)))
      .orderBy(asc(waterEntries.loggedAt), asc(waterEntries.id)),
    getProfile(ctx),
  ]);
  const entries = rows.map(toWaterEntry);
  return {
    date: day,
    totalMl: entries.reduce((sum, e) => sum + e.amountMl, 0),
    goalMl: profile.waterGoalMl,
    entries,
  };
}

/** Sets the daily water goal in ml (0-10,000). */
export async function setWaterGoal(ctx: ServiceContext, goalMl: number): Promise<number> {
  const value = parseInput(WaterGoalSchema, goalMl);
  const row = await updateProfile(ctx, { waterGoalMl: value });
  return row.waterGoalMl;
}
