import "server-only";
import { eq } from "drizzle-orm";
import {
  calculateAge,
  calculateCalories,
  CalorieOverridesSchema,
  isCalorieInputError,
  type BodyProfile,
  type CalorieCalculation,
  type CalorieOverrides,
  type GoalSettings,
} from "@/domain/calories";
import { AppError, validationError, type FieldErrors } from "@/lib/errors";
import { todayInTimezone } from "@/lib/dates";
import type { ServiceContext } from "@/server/context";
import { userProfiles } from "@/server/db/schema";
import { getProfile, toFieldErrors } from "../profile/profile";
import { getCurrentWeight } from "../profile/weight";

export type { CalorieOverrides };

/** A calculation plus the exact inputs it used (for "berechnet mit 84 kg, 33 Jahre …" in the UI). */
export interface UserCalorieCalculation extends CalorieCalculation {
  input: {
    body: BodyProfile;
    goal: GoalSettings;
    /** Where the weight came from: an override, the latest weight entry or the start weight. */
    weightSource: "override" | "entry" | "start";
  };
}

const MISSING = {
  birthDate: "Bitte gib dein Geburtsdatum an, damit wir deinen Bedarf berechnen können.",
  heightCm: "Bitte gib deine Größe an, damit wir deinen Bedarf berechnen können.",
  weightKg: "Bitte gib dein Gewicht an, damit wir deinen Bedarf berechnen können.",
} as const;

/**
 * Calculates BMR → TDEE → daily target for the context user from their stored profile and current
 * weight (latest weight entry, else start weight). `overrides` replace stored values for this one
 * calculation – onboarding and the settings preview compute before anything is saved. Read-only.
 *
 *   await calculateCaloriesForUser(ctx)                                   // stored data
 *   await calculateCaloriesForUser(ctx, { weightKg: 82, goalPace: "slow" }) // preview
 *
 * Throws AppError("VALIDATION") with German fieldErrors when data is missing or out of range
 * (e.g. { birthDate: ["Bitte gib dein Geburtsdatum an, …"] }), NOT_FOUND without profile row.
 */
export async function calculateCaloriesForUser(
  ctx: ServiceContext,
  overrides: CalorieOverrides = {},
): Promise<UserCalorieCalculation> {
  const parsed = CalorieOverridesSchema.safeParse(overrides);
  if (!parsed.success) throw validationError(toFieldErrors(parsed.error));
  const o = parsed.data;

  const profile = await getProfile(ctx);
  const current = o.weightKg === undefined ? await getCurrentWeight(ctx) : null;

  const errors: FieldErrors = {};
  let ageYears = o.ageYears ?? null;
  if (ageYears === null) {
    const birthDate = o.birthDate ?? profile.birthDate;
    if (!birthDate) errors.birthDate = [MISSING.birthDate];
    else {
      try {
        ageYears = calculateAge(birthDate, todayInTimezone(ctx.timezone));
      } catch {
        errors.birthDate = ["Bitte ein gültiges Geburtsdatum angeben."];
      }
    }
  }
  const heightCm = o.heightCm ?? profile.heightCm;
  if (heightCm == null) errors.heightCm = [MISSING.heightCm];
  const weightKg = o.weightKg ?? current?.weightKg ?? null;
  if (weightKg == null) errors.weightKg = [MISSING.weightKg];

  if (ageYears === null || heightCm == null || weightKg == null) {
    throw validationError(errors, "Für die Berechnung fehlen noch ein paar Angaben.");
  }

  const body: BodyProfile = {
    ageYears,
    sex: o.sex ?? profile.sex,
    heightCm,
    weightKg,
    bodyFatPct: o.bodyFatPct !== undefined ? o.bodyFatPct : (current?.bodyFatPct ?? null),
    activityLevel: o.activityLevel ?? profile.activityLevel,
  };
  const goal: GoalSettings = {
    type: o.goalType ?? profile.goalType,
    pace: o.goalPace !== undefined ? o.goalPace : profile.goalPace,
    targetWeightKg: o.targetWeightKg !== undefined ? o.targetWeightKg : profile.targetWeightKg,
  };
  const calculatorId = o.calculatorId !== undefined ? o.calculatorId : profile.calculatorId;

  try {
    const calculation = calculateCalories(body, goal, { calculatorId });
    return {
      ...calculation,
      input: { body, goal, weightSource: o.weightKg !== undefined ? "override" : (current?.source ?? "start") },
    };
  } catch (err) {
    if (isCalorieInputError(err)) throw validationError({ [err.field]: [err.message] }, err.message);
    throw err;
  }
}

/**
 * Recalculates from the stored profile and writes the rounded BMR/TDEE to
 * user_profiles.bmr_kcal / tdee_kcal (shown as "Grundumsatz"/"Erhaltungsbedarf").
 * Returns the full calculation so callers can pass `target` on to the macro engine.
 * Does not touch goal_profiles.
 */
export async function recalculateAndStore(ctx: ServiceContext): Promise<UserCalorieCalculation> {
  const calculation = await calculateCaloriesForUser(ctx);
  const [row] = await ctx.db
    .update(userProfiles)
    .set({ bmrKcal: Math.round(calculation.bmr), tdeeKcal: Math.round(calculation.tdee) })
    .where(eq(userProfiles.userId, ctx.userId))
    .returning({ userId: userProfiles.userId });
  if (!row) throw new AppError("NOT_FOUND", "Profil nicht gefunden.");
  return calculation;
}
