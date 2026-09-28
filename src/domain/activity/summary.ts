import type { ActivityLike, ActivitySource, ActivityTotals } from "./types";

function num(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Totals of one day's activity rows.
 *
 * - `activeKcal` = Σ calories_burned over ALL rows – identical to what the nutrition engine adds to the
 *   budget when "Aktivitätskalorien addieren" is on, so card and budget always agree.
 * - `minutes` / `count` only consider non-steps rows.
 * - `steps`: steps rows are summed per source, then the highest source wins. A phone and a watch (or a
 *   manual entry and a synced one) measure the *same* walking, so adding sources would double count.
 */
export function summarizeActivities(rows: readonly ActivityLike[]): ActivityTotals {
  let activeKcal = 0;
  let minutes = 0;
  let count = 0;
  const stepsBySource = new Map<ActivitySource, number>();

  for (const row of rows) {
    activeKcal += num(row.caloriesBurned);
    if (row.type === "steps") {
      stepsBySource.set(row.source, (stepsBySource.get(row.source) ?? 0) + num(row.steps));
    } else {
      minutes += num(row.durationMin);
      count += 1;
    }
  }

  const steps = Math.max(0, ...stepsBySource.values());
  return { activeKcal, minutes, steps, count };
}

/** Progress 0…∞ towards a goal; 0 when the goal is 0/invalid. */
export function goalProgress(value: number, goal: number): number {
  return goal > 0 && Number.isFinite(value) ? Math.max(0, value) / goal : 0;
}
