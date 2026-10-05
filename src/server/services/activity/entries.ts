import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  AddActivitySchema,
  DEFAULT_WEIGHT_KG,
  estimateActivityKcal,
  getMetActivity,
  IdSchema,
  IsoDateSchema,
  UpdateActivitySchema,
  type ActivitySource,
  type ActivityType,
  type AddActivityInput,
  type UpdateActivityInput,
} from "@/domain/activity";
import { notFound, validationError } from "@/lib/errors";
import { parseInput } from "./internal";
import type { IsoDate } from "@/lib/dates";
import { getCurrentWeightKg } from "@/server/services/profile";
import type { ServiceContext } from "@/server/context";
import { activities } from "@/server/db/schema";

export type ActivityRow = typeof activities.$inferSelect;

/** Known keys inside activities.details (jsonb). */
export interface ActivityDetails {
  metKey?: string;
  met?: number;
  /** True while calories_burned is the MET estimate (not typed in by the user / not from a device). */
  kcalEstimated?: boolean;
  /** Weight used for the estimate. */
  weightKg?: number;
  note?: string;
  [key: string]: unknown;
}

/** Serializable activity for the UI (dates as ISO strings). */
export interface ActivityEntry {
  id: string;
  date: IsoDate;
  type: ActivityType;
  name: string;
  durationMin: number | null;
  steps: number | null;
  distanceKm: number | null;
  caloriesBurned: number | null;
  source: ActivitySource;
  metKey: string | null;
  kcalEstimated: boolean;
  note: string | null;
  startedAt: string | null;
  createdAt: string;
}

export function toActivityEntry(row: ActivityRow): ActivityEntry {
  const details = (row.details ?? {}) as ActivityDetails;
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    name: row.name,
    durationMin: row.durationMin,
    steps: row.steps,
    distanceKm: row.distanceKm,
    caloriesBurned: row.caloriesBurned,
    source: row.source,
    metKey: typeof details.metKey === "string" ? details.metKey : null,
    kcalEstimated: details.kcalEstimated === true,
    note: typeof details.note === "string" && details.note ? details.note : null,
    startedAt: row.startedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Current weight for estimates (latest entry → start weight → 70 kg fallback). */
export async function weightForEstimates(
  ctx: ServiceContext,
): Promise<{ weightKg: number; isFallback: boolean }> {
  const kg = await getCurrentWeightKg(ctx);
  return kg == null ? { weightKg: DEFAULT_WEIGHT_KG, isFallback: true } : { weightKg: kg, isFallback: false };
}

/**
 * Logs an activity. With `metKey` the name/type come from the MET table and: unless `caloriesBurned`
 * is given: the kcal are estimated as (MET − 1) × current weight × hours. A custom activity needs a
 * `name` and `caloriesBurned`.
 */
export async function addActivity(ctx: ServiceContext, input: AddActivityInput): Promise<ActivityEntry> {
  const data = parseInput(AddActivitySchema, input);
  const met = getMetActivity(data.metKey);

  const details: ActivityDetails = {};
  let caloriesBurned = data.caloriesBurned ?? null;
  if (met) {
    details.metKey = met.key;
    details.met = met.met;
    if (caloriesBurned == null) {
      const { weightKg } = await weightForEstimates(ctx);
      caloriesBurned = estimateActivityKcal({ met: met.met, weightKg, durationMin: data.durationMin });
      details.kcalEstimated = true;
      details.weightKg = weightKg;
    }
  }
  if (data.note) details.note = data.note;

  const [row] = await ctx.db
    .insert(activities)
    .values({
      userId: ctx.userId,
      date: data.date,
      type: met?.type ?? "other",
      name: data.name || met?.name || "Aktivität",
      durationMin: data.durationMin,
      caloriesBurned,
      details,
      source: "manual",
    })
    .returning();
  return toActivityEntry(row);
}

async function findOwn(ctx: ServiceContext, id: string): Promise<ActivityRow> {
  const [row] = await ctx.db
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, ctx.userId)))
    .limit(1);
  if (!row) throw notFound("Aktivität");
  return row;
}

/**
 * Updates name, duration, kcal or note.
 * - `caloriesBurned: number` → manual override (no longer estimated).
 * - `caloriesBurned: null` → re-estimate from the MET value (only for MET activities).
 * - duration changed and kcal were estimated → re-estimated with the new duration.
 * Steps rows are edited via setDailySteps.
 */
export async function updateActivity(
  ctx: ServiceContext,
  input: UpdateActivityInput,
): Promise<ActivityEntry> {
  const data = parseInput(UpdateActivitySchema, input);
  const row = await findOwn(ctx, data.id);
  if (row.type === "steps") {
    throw validationError({ _: ["Schritte bitte über „Schritte bearbeiten“ ändern."] });
  }

  const details: ActivityDetails = { ...((row.details ?? {}) as ActivityDetails) };
  const durationMin = data.durationMin ?? row.durationMin;
  let caloriesBurned = row.caloriesBurned;

  const reestimate =
    data.caloriesBurned === null ||
    (data.caloriesBurned === undefined && data.durationMin !== undefined && details.kcalEstimated === true);

  if (typeof data.caloriesBurned === "number") {
    caloriesBurned = data.caloriesBurned;
    details.kcalEstimated = false;
    delete details.weightKg;
  } else if (reestimate) {
    if (typeof details.met !== "number" || durationMin == null) {
      throw validationError({ caloriesBurned: ["Für eigene Aktivitäten bitte die Kalorien angeben."] });
    }
    const { weightKg } = await weightForEstimates(ctx);
    caloriesBurned = estimateActivityKcal({ met: details.met, weightKg, durationMin });
    details.kcalEstimated = true;
    details.weightKg = weightKg;
  }

  if (data.note !== undefined) {
    if (data.note) details.note = data.note;
    else delete details.note;
  }

  const [updated] = await ctx.db
    .update(activities)
    .set({ name: data.name ?? row.name, durationMin, caloriesBurned, details })
    .where(and(eq(activities.id, row.id), eq(activities.userId, ctx.userId)))
    .returning();
  return toActivityEntry(updated);
}

/** Deletes an activity of the user; returns the deleted entry (for undo). */
export async function deleteActivity(ctx: ServiceContext, id: string): Promise<ActivityEntry> {
  const data = parseInput(IdSchema, { id });
  const [row] = await ctx.db
    .delete(activities)
    .where(and(eq(activities.id, data.id), eq(activities.userId, ctx.userId)))
    .returning();
  if (!row) throw notFound("Aktivität");
  return toActivityEntry(row);
}

/** All activity rows of the day (incl. steps rows), oldest first. */
export async function listActivities(ctx: ServiceContext, date: IsoDate): Promise<ActivityEntry[]> {
  const day = parseInput(IsoDateSchema, date);
  const rows = await ctx.db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, ctx.userId), eq(activities.date, day)))
    .orderBy(sql`coalesce(${activities.startedAt}, ${activities.createdAt})`, asc(activities.id));
  return rows.map(toActivityEntry);
}
