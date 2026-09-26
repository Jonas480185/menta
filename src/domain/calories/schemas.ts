import { z } from "@/lib/zod";
import { BODY_LIMITS } from "./constants";

/**
 * Zod schemas for calorie input – shared by server actions and client forms (German messages).
 * Ranges come from BODY_LIMITS (height/weight = DB CHECKs).
 */

export const SexSchema = z.enum(["female", "male", "unspecified"], { error: "Bitte eine Auswahl treffen." });
export const ActivityLevelSchema = z.enum(["sedentary", "light", "moderate", "active", "very_active"], {
  error: "Bitte wähle aus, wie aktiv du im Alltag bist.",
});
export const GoalTypeSchema = z.enum(["lose", "maintain", "gain"], { error: "Bitte wähle ein Ziel aus." });
export const GoalPaceSchema = z.enum(["slow", "moderate", "fast"], { error: "Bitte wähle ein Tempo aus." });

const ranged = (range: { min: number; max: number }, message: string) =>
  z.number({ error: message }).finite(message).min(range.min, message).max(range.max, message);

const { ageYears, heightCm, weightKg } = BODY_LIMITS;

export const HeightCmSchema = ranged(heightCm, `Bitte eine Größe zwischen ${heightCm.min} und ${heightCm.max} cm eingeben.`);
export const WeightKgSchema = ranged(weightKg, `Bitte ein Gewicht zwischen ${weightKg.min} und ${weightKg.max} kg eingeben.`);
export const TargetWeightKgSchema = ranged(
  weightKg,
  `Bitte ein Zielgewicht zwischen ${weightKg.min} und ${weightKg.max} kg eingeben.`,
);
export const AgeYearsSchema = ranged(ageYears, `Bitte ein Alter zwischen ${ageYears.min} und ${ageYears.max} Jahren angeben.`);
export const BodyFatPctSchema = ranged({ min: 0, max: 100 }, "Bitte einen Körperfettanteil zwischen 0 und 100 % eingeben.");

export const BodyProfileSchema = z.object({
  ageYears: AgeYearsSchema,
  sex: SexSchema,
  heightCm: HeightCmSchema,
  weightKg: WeightKgSchema,
  bodyFatPct: BodyFatPctSchema.nullish(),
  activityLevel: ActivityLevelSchema,
});

export const GoalSettingsSchema = z.object({
  type: GoalTypeSchema,
  pace: GoalPaceSchema.nullish(),
  targetWeightKg: TargetWeightKgSchema.nullish(),
});

/** Input of previewCalories() / a live-preview server action. */
export const CalorieInputSchema = z.object({
  profile: BodyProfileSchema,
  goal: GoalSettingsSchema,
  calculatorId: z.string().max(64).nullish(),
});

export type CalorieInput = z.infer<typeof CalorieInputSchema>;
