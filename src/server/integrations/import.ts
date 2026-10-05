import "server-only";
import { sql } from "drizzle-orm";
import { ActivityImportItemSchema, ActivitySourceSchema, type ActivitySource } from "@/domain/activity";
import { AppError } from "@/lib/errors";
import { z } from "@/lib/zod";
import { inTransaction, type ServiceContext } from "@/server/context";
import { activities } from "@/server/db/schema";
import { parseInput } from "@/server/services/activity/internal";
import { getActivityProvider } from "./registry";
import type { ActivityImportItem, DailyStepsItem, DateRange } from "./types";

export interface ImportResult {
  inserted: number;
  updated: number;
}

/**
 * Persists provider items for the user: idempotent per (user, source, externalId): re-importing the
 * same upstream id updates the row instead of creating a duplicate. All items are validated first
 * (payloads are external input); one invalid item rejects the whole batch (AppError VALIDATION).
 * Runs in one transaction.
 */
export async function importActivities(
  ctx: ServiceContext,
  providerId: ActivitySource,
  items: readonly ActivityImportItem[],
): Promise<ImportResult> {
  const source = parseInput(ActivitySourceSchema, providerId);
  const parsed = parseInput(z.array(ActivityImportItemSchema).max(5000), items);

  const ids = new Set<string>();
  for (const item of parsed) {
    if (ids.has(item.externalId)) {
      throw new AppError("VALIDATION", `Doppelte externe ID im Import: ${item.externalId}`);
    }
    ids.add(item.externalId);
  }
  if (parsed.length === 0) return { inserted: 0, updated: 0 };

  return inTransaction(ctx, async (tx) => {
    let inserted = 0;
    let updated = 0;
    for (const item of parsed) {
      const values = {
        date: item.date,
        type: item.type,
        name: item.name,
        durationMin: item.durationMin ?? null,
        steps: item.steps ?? null,
        distanceKm: item.distanceKm ?? null,
        // Steps never carry kcal (covered by the TDEE activity level): see activity-integrations.md.
        caloriesBurned: item.type === "steps" ? null : (item.caloriesBurned ?? null),
        startedAt: item.startedAt ? new Date(item.startedAt) : null,
        details: item.details ?? null,
      };
      const [row] = await tx.db
        .insert(activities)
        .values({ ...values, userId: ctx.userId, source, externalId: item.externalId })
        .onConflictDoUpdate({
          target: [activities.userId, activities.source, activities.externalId],
          targetWhere: sql`${activities.externalId} is not null`,
          set: { ...values, updatedAt: new Date() },
        })
        // xmax = 0 ⇔ the row was freshly inserted (not updated by ON CONFLICT).
        .returning({ inserted: sql<boolean>`(xmax = 0)` });
      if (row?.inserted) inserted++;
      else updated++;
    }
    return { inserted, updated };
  });
}

/** Daily steps → import items (type "steps", no kcal: see docs/architecture/activity-integrations.md). */
export function stepsToImportItems(items: readonly DailyStepsItem[]): ActivityImportItem[] {
  return items.map((s) => ({
    externalId: s.externalId ?? `steps:${s.date}`,
    date: s.date,
    type: "steps",
    name: "Schritte",
    steps: s.steps,
  }));
}

/**
 * Fetches workouts + daily steps from a provider and imports them. Unavailable provider →
 * AppError EXTERNAL with the provider's reason.
 */
export async function syncActivityProvider(
  ctx: ServiceContext,
  providerId: ActivitySource,
  range: DateRange,
): Promise<ImportResult> {
  const provider = getActivityProvider(ctx, providerId);
  const availability = await provider.isAvailable();
  if (!availability.available) throw new AppError("EXTERNAL", availability.reason);
  const [workouts, steps] = await Promise.all([
    provider.fetchActivities(range),
    provider.fetchDailySteps(range),
  ]);
  return importActivities(ctx, provider.id, [...workouts, ...stepsToImportItems(steps)]);
}
