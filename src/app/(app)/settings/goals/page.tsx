import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { GoalsForm } from "@/components/settings/goals-form";
import { getServiceContext } from "@/server/auth/context";
import { calculateCaloriesForUser } from "@/server/services/calories";
import { getDefaultGoalProfile, listGoalProfiles } from "@/server/services/goals";
import { getCurrentWeightKg, getProfile } from "@/server/services/profile";

export const metadata: Metadata = { title: "Ziele" };

export default async function GoalsPage() {
  const ctx = await getServiceContext();
  const [def, all, profile, weightKg, calc] = await Promise.all([
    getDefaultGoalProfile(ctx),
    listGoalProfiles(ctx),
    getProfile(ctx),
    getCurrentWeightKg(ctx),
    calculateCaloriesForUser(ctx).catch(() => null),
  ]);
  return (
    <main className="mx-auto w-full max-w-content space-y-4 px-gutter py-6">
      <PageHeader title="Ziele" back={{ href: "/settings", label: "Profil" }} />
      <GoalsForm
        current={
          def && {
            calorieTarget: def.calorieTarget,
            macroMode: def.macroMode,
            proteinG: def.proteinG,
            carbsG: def.carbsG,
            fatG: def.fatG,
            percents:
              def.proteinPct != null && def.carbsPct != null && def.fatPct != null
                ? { protein: def.proteinPct, carbs: def.carbsPct, fat: def.fatPct }
                : null,
          }
        }
        calculated={calc && { tdee: Math.round(calc.tdee), target: Math.round(calc.target) }}
        auto={
          weightKg
            ? {
                weightKg,
                goal: profile.goalType,
                activityLevel: profile.activityLevel,
                heightCm: profile.heightCm,
                targetWeightKg: profile.targetWeightKg,
              }
            : null
        }
        dayProfiles={all
          .filter((p) => !p.isDefault && !p.archivedAt)
          .map((p) => ({ id: p.id, name: p.name, calorieTarget: p.calorieTarget, proteinG: p.proteinG, carbsG: p.carbsG, fatG: p.fatG, weekdays: p.weekdays }))}
      />
    </main>
  );
}
