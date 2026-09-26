/**
 * Goals service internals: input parsing, error translation, target computation.
 * Not exported from the barrel.
 */
import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { computeMacroTargets, type MacroTargetSpec } from "@/domain/macros/targets";
import { MacroInputError, type MacroCalculation } from "@/domain/macros/types";
import { AppError, validationError } from "@/lib/errors";
import { VALIDATION_MESSAGE, zodFieldErrors } from "@/lib/result";
import type { ServiceContext } from "@/server/context";
import { goalProfiles, userProfiles, weightEntries } from "@/server/db/schema";
import type { GoalTargetsSchema } from "./schemas";

import type { GoalProfileRow } from "./resolve";

export type { GoalProfileRow };
export type GoalProfileInsert = typeof goalProfiles.$inferInsert;

/** Zod-parses service input; failures become AppError("VALIDATION") with field errors. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const res = schema.safeParse(input);
  if (!res.success) throw validationError(zodFieldErrors(res.error), VALIDATION_MESSAGE);
  return res.data;
}

/** Runs pure macro code and turns MacroInputError into AppError("VALIDATION") on its field. */
export function runDomain<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof MacroInputError) {
      throw new AppError("VALIDATION", err.message, { [err.field ?? "_"]: [err.message] }, { cause: err });
    }
    throw err;
  }
}

type ParsedTargets = z.output<typeof GoalTargetsSchema>;

/** Column values written for a set of targets. */
export type TargetColumns = Pick<
  GoalProfileInsert,
  | "calorieTarget"
  | "calorieSource"
  | "macroMode"
  | "proteinG"
  | "carbsG"
  | "fatG"
  | "proteinPct"
  | "carbsPct"
  | "fatPct"
  | "fiberG"
  | "sugarMaxG"
  | "sodiumMaxMg"
>;

/**
 * Validated targets → consistent integer grams (4P + 4C + 9F within ±5 kcal of the target) via the
 * Macro Engine. Rejects grams that don't fit into the calorie target (`carbs_negative`).
 * Optional extras (fiber/sugar/sodium) are only included when defined, so `undefined` keeps them.
 */
export async function computeTargetColumns(
  ctx: ServiceContext,
  t: ParsedTargets,
): Promise<{ columns: TargetColumns; calculation: MacroCalculation }> {
  let spec: MacroTargetSpec;
  switch (t.macroMode) {
    case "percent":
      spec = { mode: "percent", kcal: t.calorieTarget, percents: t.percents! };
      break;
    case "grams":
      spec = { mode: "grams", kcal: t.calorieTarget, proteinG: t.grams!.proteinG, fatG: t.grams!.fatG };
      break;
    case "auto":
      spec = { mode: "auto", kcal: t.calorieTarget, ...(await resolveAutoInput(ctx, t.autoInput ?? {})) };
      break;
  }
  const calculation = runDomain(() => computeMacroTargets(spec));
  const negative = calculation.warnings.find((w) => w.code === "carbs_negative");
  if (negative) throw validationError({ grams: [negative.message] }, negative.message);

  const columns: TargetColumns = {
    calorieTarget: t.calorieTarget,
    calorieSource: t.calorieSource,
    macroMode: t.macroMode,
    proteinG: calculation.macros.proteinG,
    carbsG: calculation.macros.carbsG,
    fatG: calculation.macros.fatG,
    // The user's own shares are kept for re-display; grams are the source of truth for tracking.
    proteinPct: t.macroMode === "percent" ? t.percents!.protein : null,
    carbsPct: t.macroMode === "percent" ? t.percents!.carbs : null,
    fatPct: t.macroMode === "percent" ? t.percents!.fat : null,
  };
  if (t.fiberG !== undefined) columns.fiberG = t.fiberG;
  if (t.sugarMaxG !== undefined) columns.sugarMaxG = t.sugarMaxG;
  if (t.sodiumMaxMg !== undefined) columns.sodiumMaxMg = t.sodiumMaxMg;
  return { columns, calculation };
}

/** Fills missing auto-mode inputs from user_profiles and the latest weight entry. */
async function resolveAutoInput(ctx: ServiceContext, given: NonNullable<ParsedTargets["autoInput"]>) {
  const [profile] = await ctx.db
    .select({
      goalType: userProfiles.goalType,
      activityLevel: userProfiles.activityLevel,
      heightCm: userProfiles.heightCm,
      targetWeightKg: userProfiles.targetWeightKg,
      startWeightKg: userProfiles.startWeightKg,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, ctx.userId))
    .limit(1);

  let weightKg = given.weightKg;
  if (weightKg === undefined) {
    const [latest] = await ctx.db
      .select({ weightKg: weightEntries.weightKg })
      .from(weightEntries)
      .where(eq(weightEntries.userId, ctx.userId))
      .orderBy(desc(weightEntries.date))
      .limit(1);
    weightKg = latest?.weightKg ?? profile?.startWeightKg ?? undefined;
  }
  if (weightKg === undefined) {
    const msg = "Für die automatische Empfehlung brauchen wir dein Gewicht.";
    throw validationError({ "autoInput.weightKg": [msg] }, msg);
  }
  return {
    weightKg,
    targetWeightKg:
      given.targetWeightKg !== undefined ? given.targetWeightKg : (profile?.targetWeightKg ?? null),
    heightCm: given.heightCm !== undefined ? given.heightCm : (profile?.heightCm ?? null),
    goal: given.goal ?? profile?.goalType ?? "maintain",
    activityLevel: given.activityLevel ?? profile?.activityLevel ?? "moderate",
  };
}

/** Consistency payload for a stored profile (used when targets were not recomputed). */
export function storedCalculationInput(row: GoalProfileRow) {
  return { kcal: row.calorieTarget, macros: { proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG } };
}

/** Loads one of the user's profiles or throws NOT_FOUND (also for other users' ids). */
export async function loadOwnProfile(ctx: ServiceContext, id: string, opts: { forUpdate?: boolean } = {}) {
  const q = ctx.db
    .select()
    .from(goalProfiles)
    .where(and(eq(goalProfiles.id, id), eq(goalProfiles.userId, ctx.userId)))
    .limit(1);
  const [row] = opts.forUpdate ? await q.for("update") : await q;
  if (!row) throw new AppError("NOT_FOUND", "Profil nicht gefunden.");
  return row;
}

/** Active (non-archived) profiles of the user; `lock` serializes concurrent schedule changes. */
export async function loadActiveProfiles(ctx: ServiceContext, opts: { lock?: boolean } = {}) {
  const q = ctx.db
    .select()
    .from(goalProfiles)
    .where(and(eq(goalProfiles.userId, ctx.userId), isNull(goalProfiles.archivedAt)))
    .orderBy(desc(goalProfiles.isDefault), goalProfiles.createdAt, goalProfiles.id);
  return opts.lock ? q.for("update") : q;
}
