"use server";

import { revalidatePath } from "next/cache";
import {
  AddActivitySchema,
  AddWaterSchema,
  IdSchema,
  SetDailyStepsSchema,
  StepGoalSchema,
  UpdateActivitySchema,
  WaterGoalSchema,
} from "@/domain/activity";
import { runAction, type ActionResult } from "@/lib/result";
import { z } from "@/lib/zod";
import { getServiceContext } from "@/server/auth/context";
import {
  addActivity,
  deleteActivity,
  setAddActivityCalories,
  setDailySteps,
  setStepGoal,
  updateActivity,
  type ActivityEntry,
} from "@/server/services/activity";
import { addWater, deleteWater, setWaterGoal, type WaterEntry } from "@/server/services/water";

/** Every page that shows activity, steps or water. */
function revalidateActivity() {
  revalidatePath("/activity");
  revalidatePath("/today");
  revalidatePath("/diary", "layout");
}

// ── Water ────────────────────────────────────────────────────────────────────

export async function addWaterAction(input: unknown): Promise<ActionResult<WaterEntry>> {
  return runAction(async () => {
    const data = AddWaterSchema.parse(input);
    const ctx = await getServiceContext();
    const entry = await addWater(ctx, data.date, data.amountMl, {
      loggedAt: data.loggedAt ? new Date(data.loggedAt) : undefined,
    });
    revalidateActivity();
    return entry;
  });
}

export async function deleteWaterAction(input: unknown): Promise<ActionResult<WaterEntry>> {
  return runAction(async () => {
    const { id } = IdSchema.parse(input);
    const ctx = await getServiceContext();
    const entry = await deleteWater(ctx, id);
    revalidateActivity();
    return entry;
  });
}

export async function setWaterGoalAction(input: unknown): Promise<ActionResult<{ goalMl: number }>> {
  return runAction(async () => {
    const { goalMl } = z.object({ goalMl: WaterGoalSchema }).parse(input);
    const ctx = await getServiceContext();
    const value = await setWaterGoal(ctx, goalMl);
    revalidateActivity();
    return { goalMl: value };
  });
}

// ── Activities & steps ───────────────────────────────────────────────────────

export async function addActivityAction(input: unknown): Promise<ActionResult<ActivityEntry>> {
  return runAction(async () => {
    const data = AddActivitySchema.parse(input);
    const ctx = await getServiceContext();
    const entry = await addActivity(ctx, data);
    revalidateActivity();
    return entry;
  });
}

export async function updateActivityAction(input: unknown): Promise<ActionResult<ActivityEntry>> {
  return runAction(async () => {
    const data = UpdateActivitySchema.parse(input);
    const ctx = await getServiceContext();
    const entry = await updateActivity(ctx, data);
    revalidateActivity();
    return entry;
  });
}

export async function deleteActivityAction(input: unknown): Promise<ActionResult<ActivityEntry>> {
  return runAction(async () => {
    const { id } = IdSchema.parse(input);
    const ctx = await getServiceContext();
    const entry = await deleteActivity(ctx, id);
    revalidateActivity();
    return entry;
  });
}

export async function setDailyStepsAction(input: unknown): Promise<ActionResult<{ steps: number }>> {
  return runAction(async () => {
    const data = SetDailyStepsSchema.parse(input);
    const ctx = await getServiceContext();
    const result = await setDailySteps(ctx, data.date, data.steps);
    revalidateActivity();
    return { steps: result.steps };
  });
}

export async function setStepGoalAction(input: unknown): Promise<ActionResult<{ stepGoal: number }>> {
  return runAction(async () => {
    const { stepGoal } = z.object({ stepGoal: StepGoalSchema }).parse(input);
    const ctx = await getServiceContext();
    const value = await setStepGoal(ctx, stepGoal);
    revalidateActivity();
    return { stepGoal: value };
  });
}

export async function setAddActivityCaloriesAction(input: unknown): Promise<ActionResult<{ enabled: boolean }>> {
  return runAction(async () => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(input);
    const ctx = await getServiceContext();
    const value = await setAddActivityCalories(ctx, enabled);
    revalidateActivity();
    revalidatePath("/settings", "layout");
    return { enabled: value };
  });
}
