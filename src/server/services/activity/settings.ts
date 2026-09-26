import "server-only";
import { StepGoalSchema } from "@/domain/activity";
import { z } from "@/lib/zod";
import type { ServiceContext } from "@/server/context";
import { updateProfile } from "@/server/services/profile";
import { parseInput } from "./internal";

/** Toggles whether logged activity calories are added to the daily calorie budget. */
export async function setAddActivityCalories(ctx: ServiceContext, enabled: boolean): Promise<boolean> {
  const value = parseInput(z.boolean(), enabled);
  const row = await updateProfile(ctx, { addActivityCalories: value });
  return row.addActivityCalories;
}

/** Sets the daily step goal (0–100,000). */
export async function setStepGoal(ctx: ServiceContext, stepGoal: number): Promise<number> {
  const value = parseInput(StepGoalSchema, stepGoal);
  const row = await updateProfile(ctx, { stepGoal: value });
  return row.stepGoal;
}
