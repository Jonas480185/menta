import { ISO_DATE_RE } from "@/lib/dates";
import { z } from "@/lib/zod";

/** Plausible body-weight range for entries (the DB allows 20–400 kg). */
export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 300;
export const BODY_FAT_MIN_PCT = 2;
export const BODY_FAT_MAX_PCT = 70;
export const WEIGHT_NOTE_MAX = 200;

export const isoDateSchema = z.string().regex(ISO_DATE_RE, "Bitte ein gültiges Datum wählen.");

/** Input for logging / editing the weight of one day (shared by the form, the action and the service). */
export const weightEntryInputSchema = z.object({
  date: isoDateSchema,
  weightKg: z
    .number({ error: "Bitte ein Gewicht eingeben." })
    .min(WEIGHT_MIN_KG, `Bitte ein Gewicht zwischen ${WEIGHT_MIN_KG} und ${WEIGHT_MAX_KG} kg eingeben.`)
    .max(WEIGHT_MAX_KG, `Bitte ein Gewicht zwischen ${WEIGHT_MIN_KG} und ${WEIGHT_MAX_KG} kg eingeben.`),
  bodyFatPct: z
    .number()
    .min(BODY_FAT_MIN_PCT, `Körperfett bitte zwischen ${BODY_FAT_MIN_PCT} und ${BODY_FAT_MAX_PCT} % angeben.`)
    .max(BODY_FAT_MAX_PCT, `Körperfett bitte zwischen ${BODY_FAT_MIN_PCT} und ${BODY_FAT_MAX_PCT} % angeben.`)
    .nullish(),
  note: z
    .string()
    .trim()
    .max(WEIGHT_NOTE_MAX, `Notiz bitte kürzer als ${WEIGHT_NOTE_MAX} Zeichen.`)
    .nullish()
    .transform((v) => (v ? v : null)),
});

export type WeightEntryInput = z.input<typeof weightEntryInputSchema>;
export type WeightEntryData = z.output<typeof weightEntryInputSchema>;

export const weightRangeSchema = z
  .object({ from: isoDateSchema.optional(), to: isoDateSchema.optional() })
  .refine((r) => !r.from || !r.to || r.from <= r.to, { message: "Startdatum liegt nach dem Enddatum." });

/**
 * Plausibility hint (non-blocking): a jump of more than this vs. the previous entry
 * suggests a typo ("8,34 statt 83,4?").
 */
export const WEIGHT_JUMP_HINT_KG = 3;
