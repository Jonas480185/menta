"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/result";
import { todayInTimezone } from "@/lib/dates";
import { getServiceContext } from "@/server/auth/context";
import { inTransaction } from "@/server/context";
import { recalculateAndStore } from "@/server/services/calories";
import {
  archiveGoalProfile,
  createDerivedGoalProfile,
  upsertDefaultGoalProfile,
} from "@/server/services/goals";
import { archiveMeal, createMeal, moveMeal, renameMeal } from "@/server/services/logging";
import { refreshTargetsFrom } from "@/server/services/nutrition";
import { updateProfile } from "@/server/services/profile";
import type { ProfilePatch } from "@/domain/calories";

function refreshAll() {
  revalidatePath("/", "layout");
}

export async function saveGoalsAction(input: Parameters<typeof upsertDefaultGoalProfile>[1]) {
  return runAction(async () => {
    const ctx = await getServiceContext();
    await inTransaction(ctx, async (tx) => {
      await upsertDefaultGoalProfile(tx, input);
      await refreshTargetsFrom(tx, todayInTimezone(tx.timezone));
    });
    refreshAll();
  });
}

export async function addDayProfileAction(input: { kind: "training" | "rest" | "high_carb" | "low_carb" | "refeed"; weekdays: number[] }) {
  return runAction(async () => {
    const ctx = await getServiceContext();
    await inTransaction(ctx, async (tx) => {
      await createDerivedGoalProfile(tx, { kind: input.kind, weekdays: input.weekdays });
      await refreshTargetsFrom(tx, todayInTimezone(tx.timezone));
    });
    refreshAll();
  });
}

export async function archiveDayProfileAction(id: string) {
  return runAction(async () => {
    const ctx = await getServiceContext();
    await archiveGoalProfile(ctx, id);
    await refreshTargetsFrom(ctx, todayInTimezone(ctx.timezone));
    refreshAll();
  });
}

export async function saveProfileAction(patch: ProfilePatch) {
  return runAction(async () => {
    const ctx = await getServiceContext();
    await updateProfile(ctx, patch);
    const calc = await recalculateAndStore(ctx);
    refreshAll();
    return { tdee: Math.round(calc.tdee), target: Math.round(calc.target) };
  });
}

export async function mealAction(
  op: { type: "create"; name: string } | { type: "rename"; id: string; name: string } | { type: "archive"; id: string } | { type: "move"; id: string; dir: -1 | 1 },
) {
  return runAction(async () => {
    const ctx = await getServiceContext();
    if (op.type === "create") await createMeal(ctx, op.name);
    if (op.type === "rename") await renameMeal(ctx, op.id, op.name);
    if (op.type === "archive") await archiveMeal(ctx, op.id);
    if (op.type === "move") await moveMeal(ctx, op.id, op.dir);
    refreshAll();
  });
}
