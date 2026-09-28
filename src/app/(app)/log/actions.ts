"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/result";
import { getServiceContext } from "@/server/auth/context";
import {
  addEntry,
  copyEntries,
  deleteEntry,
  duplicateEntry,
  restoreEntry,
  updateEntry,
  type EntryInput,
} from "@/server/services/logging";
import { getFoodForUser, toggleFavorite } from "@/server/services/foods";
import { evaluateAchievementsSafe } from "@/server/services/engagement";

function refresh() {
  revalidatePath("/today");
  revalidatePath("/diary", "layout");
  revalidatePath("/log");
}

export async function addEntryAction(input: EntryInput) {
  return runAction(async () => {
    const ctx = await getServiceContext();
    const row = await addEntry(ctx, input);
    await evaluateAchievementsSafe(ctx);
    refresh();
    return { id: row.id, date: row.date };
  });
}

/** One tap: re-log a food with its last (or default) portion. */
export async function quickAddAction(input: { foodId: string; date: string; mealId: string }) {
  return runAction(async () => {
    const ctx = await getServiceContext();
    const food = await getFoodForUser(ctx, input.foodId);
    const serving =
      food.servings.find((s) => s.id === food.lastUsage?.servingId) ?? food.servings.find((s) => s.isDefault);
    const row = await addEntry(ctx, {
      ...input,
      servingId: serving?.id ?? null,
      quantity: food.lastUsage?.quantity ?? 1,
    });
    await evaluateAchievementsSafe(ctx);
    refresh();
    return { id: row.id, name: food.name, kcal: row.kcal };
  });
}

export async function updateEntryAction(
  id: string,
  input: { servingId?: string | null; quantity?: number; mealId?: string; date?: string },
) {
  return runAction(async () => {
    const row = await updateEntry(await getServiceContext(), id, input);
    refresh();
    return { id: row.id, date: row.date };
  });
}

export async function deleteEntryAction(id: string) {
  return runAction(async () => {
    const row = await deleteEntry(await getServiceContext(), id);
    refresh();
    return row;
  });
}

export async function restoreEntryAction(row: Awaited<ReturnType<typeof deleteEntry>>) {
  return runAction(async () => {
    await restoreEntry(await getServiceContext(), { ...row, loggedAt: new Date(row.loggedAt), createdAt: new Date(row.createdAt), updatedAt: new Date() });
    refresh();
  });
}

export async function duplicateEntryAction(id: string) {
  return runAction(async () => {
    await duplicateEntry(await getServiceContext(), id);
    refresh();
  });
}

export async function copyEntriesAction(from: { date: string; mealId?: string }, to: { date: string; mealId?: string }) {
  return runAction(async () => {
    const n = await copyEntries(await getServiceContext(), from, to);
    refresh();
    return n;
  });
}

export async function toggleFavoriteAction(foodId: string) {
  return runAction(async () => {
    const fav = await toggleFavorite(await getServiceContext(), foodId);
    revalidatePath("/foods");
    return fav;
  });
}
