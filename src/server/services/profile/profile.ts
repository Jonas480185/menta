import "server-only";
import { eq } from "drizzle-orm";
import { calculateAge, isCalculatorId, BODY_LIMITS, ProfilePatchSchema, type ProfilePatch } from "@/domain/calories";
import { AppError, notFound, validationError, type FieldErrors } from "@/lib/errors";
import { todayInTimezone } from "@/lib/dates";
import { z } from "@/lib/zod";
import type { ServiceContext } from "@/server/context";
import { userProfiles } from "@/server/db/schema";

/** Zod error → FieldErrors (unknown keys land under "_"). Local, because @/lib/result pulls in next/*. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const keys = issue.code === "unrecognized_keys" ? issue.keys : [String(issue.path[0] ?? "_")];
    for (const key of keys) (out[key] ??= []).push(issue.message);
  }
  return out;
}

export type ProfileRow = typeof userProfiles.$inferSelect;

/**
 * The user's profile row (body data, goal, preferences, last computed BMR/TDEE).
 * Every account gets one at sign-up (bootstrapAccount); a missing row → AppError NOT_FOUND.
 */
export async function getProfile(ctx: ServiceContext): Promise<ProfileRow> {
  const [row] = await ctx.db.select().from(userProfiles).where(eq(userProfiles.userId, ctx.userId)).limit(1);
  if (!row) throw notFound("Profil");
  return row;
}

/**
 * Validates and applies a partial profile update, returns the updated row.
 *
 * - `patch` is parsed with ProfilePatchSchema (strict: unknown keys, bmr/tdee etc. are rejected).
 * - Cross-field rules against the merged row: age 14–120 on the user's today, "maintain" clears the
 *   pace, "gain" has no "fast" pace, the calculator id must exist.
 * - Does NOT recalculate BMR/TDEE – call `recalculateAndStore(ctx)` (services/calories) afterwards
 *   when body data, activity or goal changed.
 *
 * Throws AppError("VALIDATION") with German fieldErrors.
 */
export async function updateProfile(ctx: ServiceContext, patch: ProfilePatch): Promise<ProfileRow> {
  const parsed = ProfilePatchSchema.safeParse(patch);
  if (!parsed.success) throw validationError(toFieldErrors(parsed.error));
  const data = parsed.data;

  const current = await getProfile(ctx);
  const errors: FieldErrors = {};

  if (data.birthDate !== undefined) {
    const today = todayInTimezone(data.timezone ?? current.timezone ?? ctx.timezone);
    let age: number | null = null;
    try {
      age = calculateAge(data.birthDate, today);
    } catch {
      age = null;
    }
    const { min, max } = BODY_LIMITS.ageYears;
    if (age === null || age < min || age > max) {
      errors.birthDate = [`Bitte ein Geburtsdatum angeben, das ein Alter zwischen ${min} und ${max} Jahren ergibt.`];
    }
  }

  if (data.calculatorId !== undefined && !isCalculatorId(data.calculatorId)) {
    errors.calculatorId = ["Diese Berechnungsformel kennen wir nicht."];
  }

  const goalType = data.goalType ?? current.goalType;
  let goalPace = data.goalPace !== undefined ? data.goalPace : current.goalPace;
  if (goalType === "maintain") goalPace = null;
  if (goalType === "gain" && goalPace === "fast") {
    if (data.goalPace === "fast") {
      errors.goalPace = ["Zum Zunehmen gibt es die Tempi „Entspannt“ und „Moderat“."];
    } else {
      // Switching an existing "fast" lose goal to gain → fall back to the default pace.
      goalPace = "moderate";
    }
  }

  if (Object.keys(errors).length > 0) throw validationError(errors);

  const values: Partial<typeof userProfiles.$inferInsert> = { ...data };
  if (values.goalPace !== undefined || goalPace !== current.goalPace) values.goalPace = goalPace;
  if (Object.keys(values).length === 0) return current;

  const [row] = await ctx.db
    .update(userProfiles)
    .set(values)
    .where(eq(userProfiles.userId, ctx.userId))
    .returning();
  if (!row) throw new AppError("NOT_FOUND", "Profil nicht gefunden.");
  return row;
}
