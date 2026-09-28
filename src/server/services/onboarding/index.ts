import { eq } from "drizzle-orm";
import { z } from "zod";
import { inTransaction, type ServiceContext } from "@/server/context";
import { userProfiles } from "@/server/db/schema";
import { todayInTimezone } from "@/lib/dates";
import { updateProfile } from "@/server/services/profile";
import { recalculateAndStore } from "@/server/services/calories";
import { upsertDefaultGoalProfile } from "@/server/services/goals";
import { refreshTargetsFrom } from "@/server/services/nutrition";
import { upsertWeight } from "@/server/services/weight";

export const onboardingSchema = z.object({
  sex: z.enum(["female", "male", "unspecified"]),
  birthDate: z.string(),
  heightCm: z.number().min(50).max(300),
  weightKg: z.number().min(20).max(400),
  targetWeightKg: z.number().min(20).max(400).nullable(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goalType: z.enum(["lose", "maintain", "gain"]),
  goalPace: z.enum(["slow", "moderate", "fast"]).nullable(),
  calorieTarget: z.number().int().min(800).max(10000),
  calorieSource: z.enum(["calculated", "manual"]),
  macroMode: z.enum(["percent", "grams", "auto"]),
  percents: z.object({ protein: z.number(), carbs: z.number(), fat: z.number() }).optional(),
  grams: z.object({ proteinG: z.number(), fatG: z.number() }).optional(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

/**
 * Persists everything collected in onboarding in one transaction:
 * body data → weight entry → BMR/TDEE → default goal profile → today's targets → done flag.
 */
export async function completeOnboarding(ctx: ServiceContext, raw: OnboardingInput): Promise<void> {
  const input = onboardingSchema.parse(raw);
  await inTransaction(ctx, async (tx) => {
    await updateProfile(tx, {
      sex: input.sex,
      birthDate: input.birthDate,
      heightCm: input.heightCm,
      startWeightKg: input.weightKg,
      targetWeightKg: input.goalType === "maintain" ? null : input.targetWeightKg,
      activityLevel: input.activityLevel,
      goalType: input.goalType,
      goalPace: input.goalType === "maintain" ? null : input.goalPace,
    });
    const today = todayInTimezone(tx.timezone);
    await upsertWeight(tx, { date: today, weightKg: input.weightKg });
    await recalculateAndStore(tx);
    await upsertDefaultGoalProfile(tx, {
      calorieTarget: input.calorieTarget,
      calorieSource: input.calorieSource,
      macroMode: input.macroMode,
      percents: input.macroMode === "percent" ? input.percents : undefined,
      grams: input.macroMode === "grams" ? input.grams : undefined,
    });
    await refreshTargetsFrom(tx, today);
    await tx.db.update(userProfiles).set({ onboardingCompletedAt: new Date() }).where(eq(userProfiles.userId, tx.userId));
  });
}
