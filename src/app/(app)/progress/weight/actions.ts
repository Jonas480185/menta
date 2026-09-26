"use server";

import { revalidatePath } from "next/cache";
import { isoDateSchema, weightEntryInputSchema, type WeightEntryInput } from "@/domain/weight";
import { runAction, type ActionResult } from "@/lib/result";
import { getServiceContext } from "@/server/auth/context";
import {
  deleteWeight,
  upsertWeight,
  type UpsertWeightResult,
  type WeightEntry,
} from "@/server/services/weight";

function revalidateWeight() {
  revalidatePath("/progress/weight");
  revalidatePath("/today");
}

/** Log or replace the weight of one day (also used to undo a delete). */
export async function logWeightAction(input: WeightEntryInput): Promise<ActionResult<UpsertWeightResult>> {
  return runAction(async () => {
    const data = weightEntryInputSchema.parse(input);
    const ctx = await getServiceContext();
    const result = await upsertWeight(ctx, data);
    revalidateWeight();
    return result;
  });
}

/** Delete the entry of one day; returns it so the client can offer "Rückgängig". */
export async function deleteWeightAction(date: string): Promise<ActionResult<WeightEntry>> {
  return runAction(async () => {
    const day = isoDateSchema.parse(date);
    const ctx = await getServiceContext();
    const deleted = await deleteWeight(ctx, day);
    revalidateWeight();
    return deleted;
  });
}
