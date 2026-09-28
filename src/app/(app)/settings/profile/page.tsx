import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { getServiceContext } from "@/server/auth/context";
import { getProfile } from "@/server/services/profile";

export const metadata: Metadata = { title: "Körperdaten" };

export default async function ProfilePage() {
  const p = await getProfile(await getServiceContext());
  return (
    <main className="mx-auto w-full max-w-content space-y-4 px-gutter py-6">
      <PageHeader title="Körperdaten & Aktivität" back={{ href: "/settings", label: "Profil" }} />
      <ProfileForm
        initial={{
          sex: p.sex,
          birthDate: p.birthDate,
          heightCm: p.heightCm,
          targetWeightKg: p.targetWeightKg,
          activityLevel: p.activityLevel,
          goalType: p.goalType,
          goalPace: p.goalPace,
          waterGoalMl: p.waterGoalMl,
          stepGoal: p.stepGoal,
        }}
      />
      <p className="text-body-sm text-muted-foreground">Dein aktuelles Gewicht trägst du unter Fortschritt → Gewicht ein.</p>
    </main>
  );
}
