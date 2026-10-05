import { z } from "@/lib/zod";
import { BODY_LIMITS } from "./constants";

/**
 * Zod schemas for calorie input: shared by server actions and client forms (German messages).
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

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum angeben.");

/** Valid IANA timezone (checked via Intl, works in Node and browsers). */
export const TimezoneSchema = z
  .string()
  .min(1, "Bitte eine Zeitzone wählen.")
  .max(64, "Bitte eine gültige Zeitzone wählen.")
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("de-DE", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Bitte eine gültige Zeitzone wählen.");

/**
 * Patch for `updateProfile()` (src/server/services/profile): every field optional, unknown keys
 * rejected (bmr/tdee/onboarding timestamps are not user-editable). Ranges match the DB CHECKs.
 * Cross-field rules that need the stored row (gain + fast, age on "today") live in the service.
 */
export const ProfilePatchSchema = z
  .object({
    sex: SexSchema,
    birthDate: IsoDateSchema,
    heightCm: HeightCmSchema,
    startWeightKg: WeightKgSchema,
    targetWeightKg: TargetWeightKgSchema.nullable(),
    activityLevel: ActivityLevelSchema,
    goalType: GoalTypeSchema,
    goalPace: GoalPaceSchema.nullable(),
    calculatorId: z.string().min(1).max(64),
    addActivityCalories: z.boolean(),
    waterGoalMl: z.number().int("Bitte ganze Milliliter angeben.").min(0).max(10000, "Maximal 10.000 ml."),
    stepGoal: z.number().int("Bitte ganze Schritte angeben.").min(0).max(100000, "Maximal 100.000 Schritte."),
    timezone: TimezoneSchema,
    theme: z.enum(["system", "light", "dark"]),
  })
  .partial()
  .strict();

export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

/**
 * Values that override the stored profile for a single calculation: lets onboarding/settings
 * preview the result before saving. `weightKg` replaces the current weight, `ageYears` wins over
 * `birthDate`.
 */
export const CalorieOverridesSchema = z
  .object({
    sex: SexSchema,
    birthDate: IsoDateSchema,
    ageYears: AgeYearsSchema,
    heightCm: HeightCmSchema,
    weightKg: WeightKgSchema,
    bodyFatPct: BodyFatPctSchema.nullable(),
    activityLevel: ActivityLevelSchema,
    goalType: GoalTypeSchema,
    goalPace: GoalPaceSchema.nullable(),
    targetWeightKg: TargetWeightKgSchema.nullable(),
    calculatorId: z.string().min(1).max(64).nullable(),
  })
  .partial()
  .strict();

export type CalorieOverrides = z.infer<typeof CalorieOverridesSchema>;
