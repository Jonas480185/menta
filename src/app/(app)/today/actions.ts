"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/result";
import { getServiceContext } from "@/server/auth/context";
import { dismissMascotMessage } from "@/server/services/engagement";
import { copyEntries } from "@/server/services/logging";

export async function dismissMascotAction(key: string) {
  return runAction(async () => {
    await dismissMascotMessage(await getServiceContext(), key);
    revalidatePath("/today");
  });
}

export async function copyDayAction(fromDate: string, toDate: string) {
  return runAction(async () => {
    const n = await copyEntries(await getServiceContext(), { date: fromDate }, { date: toDate });
    revalidatePath("/today");
    revalidatePath("/diary", "layout");
    return n;
  });
}
