"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/result";
import { getServiceContext } from "@/server/auth/context";
import { archiveUserFood, createUserFood, updateUserFood, type UserFoodInput } from "@/server/services/user-foods";
import { evaluateAchievementsSafe } from "@/server/services/engagement";

export async function saveUserFoodAction(id: string | null, input: UserFoodInput) {
  return runAction(async () => {
    const ctx = await getServiceContext();
    const row = id ? await updateUserFood(ctx, id, input) : await createUserFood(ctx, input);
    if (!id) await evaluateAchievementsSafe(ctx);
    revalidatePath("/foods");
    return { id: row.id };
  });
}

export async function archiveUserFoodAction(id: string) {
  return runAction(async () => {
    await archiveUserFood(await getServiceContext(), id);
    revalidatePath("/foods");
  });
}
