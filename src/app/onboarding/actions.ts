"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/result";
import { getServiceContext } from "@/server/auth/context";
import { completeOnboarding, type OnboardingInput } from "@/server/services/onboarding";

export async function completeOnboardingAction(input: OnboardingInput) {
  return runAction(async () => {
    await completeOnboarding(await getServiceContext(), input);
    revalidatePath("/", "layout");
  });
}
