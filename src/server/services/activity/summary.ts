import "server-only";
import { estimateStepsKcal, summarizeActivities } from "@/domain/activity";
import type { IsoDate } from "@/lib/dates";
import type { ServiceContext } from "@/server/context";
import { getProfile } from "@/server/services/profile";
import { listActivities, weightForEstimates, type ActivityEntry } from "./entries";

export interface ActivitySummary {
  date: IsoDate;
  /** Σ calories_burned of the day: the amount the budget adds when `addActivityCalories` is on. */
  activeKcal: number;
  steps: number;
  stepGoal: number;
  /** Minutes of all non-steps activities. */
  minutes: number;
  /** Non-steps activities, oldest first. */
  entries: ActivityEntry[];
  /** user_profiles.add_activity_calories. */
  addActivityCalories: boolean;
  /** Net kcal of the steps: informational only, not part of `activeKcal`. */
  stepsKcalEstimate: number;
  /** Weight used for estimates; `weightIsFallback` = no weight known, 70 kg assumed. */
  weightKg: number;
  weightIsFallback: boolean;
}

/** Everything the activity page and the dashboard card need for one day. */
export async function getActivitySummary(ctx: ServiceContext, date: IsoDate): Promise<ActivitySummary> {
  const [rows, profile, weight] = await Promise.all([
    listActivities(ctx, date),
    getProfile(ctx),
    weightForEstimates(ctx),
  ]);
  const totals = summarizeActivities(rows);
  return {
    date,
    activeKcal: totals.activeKcal,
    steps: totals.steps,
    stepGoal: profile.stepGoal,
    minutes: totals.minutes,
    entries: rows.filter((r) => r.type !== "steps"),
    addActivityCalories: profile.addActivityCalories,
    stepsKcalEstimate: estimateStepsKcal(totals.steps, weight.weightKg),
    weightKg: weight.weightKg,
    weightIsFallback: weight.isFallback,
  };
}
