import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getOnboardingStatus, getServiceContext } from "@/server/auth/context";
import { todayInTimezone } from "@/lib/dates";

export const metadata: Metadata = { title: "Willkommen" };

export default async function OnboardingPage() {
  const ctx = await getServiceContext();
  if ((await getOnboardingStatus(ctx)).completed) redirect("/today");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-content flex-col px-gutter py-6">
      <OnboardingWizard today={todayInTimezone(ctx.timezone)} />
    </main>
  );
}
