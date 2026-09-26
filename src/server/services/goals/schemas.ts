/**
 * Zod input schemas of the Goals service. Shared with server actions/forms:
 * import the schemas (runtime) or the inferred types. No server-only imports here.
 *
 * Docs: docs/architecture/macro-engine.md §7
 */
import { z } from "@/lib/zod";
import { MAX_KCAL, MAX_MACRO_G } from "@/domain/macros/math";

const macroGrams = z
  .number()
  .min(0, "Grammwerte dürfen nicht negativ sein.")
  .max(MAX_MACRO_G, `Maximal ${MAX_MACRO_G} g.`);

const percent = z.number().min(0, "Mindestens 0 %.").max(100, "Höchstens 100 %.");

/** Optional extra target: positive number, `null` clears it, `undefined` keeps the stored value. */
const optionalTarget = (max: number) =>
  z.number().positive("Bitte einen Wert über 0 angeben.").max(max).nullable().optional();

export const MacroPercentsSchema = z.object({
  protein: percent,
  carbs: percent,
  fat: percent,
});

/** Grams mode: protein and fat are fixed; carbs fill the remaining calories. */
export const MacroGramsSchema = z.object({
  proteinG: macroGrams,
  fatG: macroGrams,
});

/**
 * Auto mode inputs. Every field is optional: missing values are taken from the user's profile
 * (goal, activity level, height, target weight) and latest weight entry (else start weight).
 */
export const AutoMacroInputSchema = z.object({
  weightKg: z.number().min(20, "Mindestens 20 kg.").max(400, "Höchstens 400 kg.").optional(),
  targetWeightKg: z.number().min(20).max(400).nullable().optional(),
  heightCm: z.number().min(50).max(300).nullable().optional(),
  goal: z.enum(["lose", "maintain", "gain"]).optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
});

const targetsShape = {
  calorieTarget: z
    .number()
    .int("Bitte ganze Kalorien angeben.")
    .min(1, "Das Kalorienziel muss größer als 0 sein.")
    .max(MAX_KCAL, `Höchstens ${MAX_KCAL} kcal.`),
  calorieSource: z.enum(["calculated", "manual"]),
  macroMode: z.enum(["percent", "grams", "auto"]),
  percents: MacroPercentsSchema.optional(),
  grams: MacroGramsSchema.optional(),
  autoInput: AutoMacroInputSchema.optional(),
  fiberG: optionalTarget(500),
  sugarMaxG: optionalTarget(2000),
  sodiumMaxMg: optionalTarget(50_000),
};

/** The mode-specific payload must be present (percent → percents, grams → grams). */
function requireModePayload(
  v: { macroMode: "percent" | "grams" | "auto"; percents?: unknown; grams?: unknown },
  ctx: z.RefinementCtx,
) {
  if (v.macroMode === "percent" && !v.percents) {
    ctx.addIssue({ code: "custom", path: ["percents"], message: "Bitte die Prozentverteilung angeben." });
  }
  if (v.macroMode === "grams" && !v.grams) {
    ctx.addIssue({ code: "custom", path: ["grams"], message: "Bitte Protein und Fett in Gramm angeben." });
  }
}

/**
 * Calorie + macro targets of a goal profile (used by onboarding, settings and day profiles).
 *
 *   { calorieTarget: 2200, calorieSource: "calculated", macroMode: "percent",
 *     percents: { protein: 30, carbs: 40, fat: 30 } }
 */
export const GoalTargetsSchema = z.object(targetsShape).superRefine(requireModePayload);
export type GoalTargetsInput = z.input<typeof GoalTargetsSchema>;

export const ProfileNameSchema = z
  .string()
  .trim()
  .min(1, "Bitte gib einen Namen ein.")
  .max(40, "Maximal 40 Zeichen.");

export const WeekdaysSchema = z
  .array(z.number().int().min(1, "Ungültiger Wochentag.").max(7, "Ungültiger Wochentag."))
  .max(7);

/** Kinds a non-default profile may have ("default" is reserved for the default profile). */
export const DayProfileKindSchema = z.enum(["training", "rest", "high_carb", "low_carb", "refeed", "custom"]);

/** Default profile: targets plus an optional name (default „Standard“). */
export const UpsertDefaultGoalProfileSchema = z
  .object({ ...targetsShape, name: ProfileNameSchema.optional() })
  .superRefine(requireModePayload);
export type UpsertDefaultGoalProfileInput = z.input<typeof UpsertDefaultGoalProfileSchema>;

export const CreateGoalProfileSchema = z
  .object({
    ...targetsShape,
    name: ProfileNameSchema,
    kind: DayProfileKindSchema.default("custom"),
    weekdays: WeekdaysSchema.default([]),
  })
  .superRefine(requireModePayload);
export type CreateGoalProfileInput = z.input<typeof CreateGoalProfileSchema>;

/** Convenience: a day profile derived from the default profile (see deriveDayProfile). */
export const CreateDerivedGoalProfileSchema = z.object({
  kind: DayProfileKindSchema,
  name: ProfileNameSchema.optional(),
  weekdays: WeekdaysSchema.default([]),
  kcalDelta: z.number().int().min(-5000).max(5000).optional(),
  fatShiftKcal: z.number().int().min(-5000).max(5000).optional(),
  maintenanceKcal: z.number().int().positive().max(MAX_KCAL).nullable().optional(),
});
export type CreateDerivedGoalProfileInput = z.input<typeof CreateDerivedGoalProfileSchema>;

/**
 * Partial update. `targets` must be complete when given (modes depend on each other);
 * `weekdays` goes through the same overlap check as setProfileWeekdays.
 */
export const UpdateGoalProfileSchema = z.object({
  name: ProfileNameSchema.optional(),
  kind: DayProfileKindSchema.optional(),
  weekdays: WeekdaysSchema.optional(),
  targets: GoalTargetsSchema.optional(),
});
export type UpdateGoalProfileInput = z.input<typeof UpdateGoalProfileSchema>;

export const GoalProfileIdSchema = z.uuid("Ungültiges Profil.");
