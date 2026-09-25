import { redirect } from "next/navigation";
import { getOnboardingStatus, getServiceContext } from "@/server/auth/context";
import { HOME_PATH, ONBOARDING_PATH } from "@/server/auth/redirects";

/** Entry point: signed out → /login, onboarding pending → /onboarding, else → /today. */
export default async function RootPage(): Promise<never> {
  const ctx = await getServiceContext(); // redirects to /login when signed out
  const { completed } = await getOnboardingStatus(ctx);
  redirect(completed ? HOME_PATH : ONBOARDING_PATH);
}
