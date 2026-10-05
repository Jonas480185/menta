import { ISO_DATE_RE } from "@/lib/dates";
import { z } from "@/lib/zod";
import { MET_ACTIVITIES } from "./met";
import { ACTIVITY_SOURCES, ACTIVITY_TYPES } from "./types";

/**
 * Input schemas shared by forms, server actions, services and provider imports.
 * Messages are German and user-facing.
 */

export const ACTIVITY_LIMITS = {
  durationMin: { min: 1, max: 1440 },
  caloriesBurned: { min: 0, max: 10000 },
  steps: { min: 0, max: 150000 },
  stepGoal: { min: 0, max: 100000 },
  waterMl: { min: 1, max: 5000 },
  waterGoalMl: { min: 0, max: 10000 },
  name: { max: 60 },
  note: { max: 200 },
} as const;

export const IsoDateSchema = z.string().regex(ISO_DATE_RE, "Ungültiges Datum.");

const metKeys = MET_ACTIVITIES.map((a) => a.key) as [string, ...string[]];

const DurationSchema = z
  .number("Bitte eine Dauer angeben.")
  .min(ACTIVITY_LIMITS.durationMin.min, "Mindestens 1 Minute.")
  .max(ACTIVITY_LIMITS.durationMin.max, "Maximal 24 Stunden.");

const KcalSchema = z
  .number("Bitte Kalorien angeben.")
  .min(0, "Kalorien können nicht negativ sein.")
  .max(ACTIVITY_LIMITS.caloriesBurned.max, "Maximal 10.000 kcal.");

const NoteSchema = z.string().trim().max(ACTIVITY_LIMITS.note.max, "Maximal 200 Zeichen.");

const NameSchema = z
  .string()
  .trim()
  .min(1, "Bitte gib einen Namen ein.")
  .max(ACTIVITY_LIMITS.name.max, "Maximal 60 Zeichen.");

/**
 * New activity. Either `metKey` (from the MET table: name/type/kcal derived) or a custom `name`
 * with explicit `caloriesBurned`. `caloriesBurned` always overrides the estimate.
 */
export const AddActivitySchema = z
  .object({
    date: IsoDateSchema,
    metKey: z.enum(metKeys, "Unbekannte Aktivität.").nullish(),
    name: NameSchema.nullish(),
    durationMin: DurationSchema,
    caloriesBurned: KcalSchema.nullish(),
    note: NoteSchema.nullish(),
  })
  .superRefine((v, ctx) => {
    if (!v.metKey && !v.name) {
      ctx.addIssue({ code: "custom", path: ["metKey"], message: "Bitte wähle eine Aktivität." });
    }
    if (!v.metKey && v.caloriesBurned == null) {
      ctx.addIssue({
        code: "custom",
        path: ["caloriesBurned"],
        message: "Für eigene Aktivitäten bitte die Kalorien angeben.",
      });
    }
  });
export type AddActivityInput = z.input<typeof AddActivitySchema>;

/** Patch of an existing activity. `caloriesBurned: null` → re-estimate from MET (if the activity has one). */
export const UpdateActivitySchema = z.object({
  id: z.uuid("Ungültiger Eintrag."),
  name: NameSchema.optional(),
  durationMin: DurationSchema.optional(),
  caloriesBurned: KcalSchema.nullable().optional(),
  note: NoteSchema.nullable().optional(),
});
export type UpdateActivityInput = z.input<typeof UpdateActivitySchema>;

export const IdSchema = z.object({ id: z.uuid("Ungültiger Eintrag.") });

export const SetDailyStepsSchema = z.object({
  date: IsoDateSchema,
  steps: z
    .number("Bitte eine Schrittzahl angeben.")
    .int("Bitte ganze Schritte angeben.")
    .min(0, "Schritte können nicht negativ sein.")
    .max(ACTIVITY_LIMITS.steps.max, "Maximal 150.000 Schritte."),
});
export type SetDailyStepsInput = z.input<typeof SetDailyStepsSchema>;

export const StepGoalSchema = z
  .number("Bitte ein Schrittziel angeben.")
  .int("Bitte ganze Schritte angeben.")
  .min(0, "Das Ziel kann nicht negativ sein.")
  .max(ACTIVITY_LIMITS.stepGoal.max, "Maximal 100.000 Schritte.");

export const AddWaterSchema = z.object({
  date: IsoDateSchema,
  amountMl: z
    .number("Bitte eine Menge angeben.")
    .int("Bitte ganze Milliliter angeben.")
    .min(ACTIVITY_LIMITS.waterMl.min, "Mindestens 1 ml.")
    .max(ACTIVITY_LIMITS.waterMl.max, "Maximal 5.000 ml pro Eintrag."),
  /** ISO timestamp: set when restoring a deleted entry (undo). */
  loggedAt: z.iso.datetime({ offset: true }).optional(),
});
export type AddWaterInput = z.input<typeof AddWaterSchema>;

export const WaterGoalSchema = z
  .number("Bitte ein Wasserziel angeben.")
  .int("Bitte ganze Milliliter angeben.")
  .min(0, "Das Ziel kann nicht negativ sein.")
  .max(ACTIVITY_LIMITS.waterGoalMl.max, "Maximal 10.000 ml.");

/**
 * One activity (or daily steps row) delivered by an integration provider. Validated before import:
 * provider payloads are external input.
 */
export const ActivityImportItemSchema = z.object({
  /** Upstream id; import is idempotent per (user, source, externalId). */
  externalId: z.string().trim().min(1).max(200),
  date: IsoDateSchema,
  type: z.enum(ACTIVITY_TYPES),
  name: NameSchema,
  durationMin: z.number().min(0).max(ACTIVITY_LIMITS.durationMin.max).nullish(),
  steps: z.number().int().min(0).max(ACTIVITY_LIMITS.steps.max).nullish(),
  distanceKm: z.number().min(0).max(1000).nullish(),
  caloriesBurned: KcalSchema.nullish(),
  startedAt: z.iso.datetime({ offset: true }).nullish(),
  details: z.record(z.string(), z.unknown()).nullish(),
});
export type ActivityImportItem = z.input<typeof ActivityImportItemSchema>;

export const ActivitySourceSchema = z.enum(ACTIVITY_SOURCES);
