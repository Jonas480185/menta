/**
 * Goals service: goal profiles ("day profiles"), read, upsert default, create,
 * update, archive, weekday schedule. Macro math is delegated to src/domain/macros.
 *
 * IMPORTANT for callers (server actions): every successful write here changes which
 * targets apply to today/future days. Afterwards call Daily Nutrition Engine's
 *   `refreshTargetsFrom(ctx, todayInTimezone(ctx.timezone))`   (module `@/server/services/nutrition`)
 * so that daily_nutrition snapshots for today and future dates are refreshed. This service does
 * NOT call it itself (no dependency on the Daily Nutrition Engine; past days stay frozen).
 *
 * Docs: docs/architecture/macro-engine.md §7
 */
import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { deriveDayProfile } from "@/domain/macros/day-profiles";
import { buildCalculation } from "@/domain/macros/math";
import { describeWeekdayConflicts, findWeekdayConflicts, normalizeWeekdays } from "@/domain/macros/schedule";
import type { MacroCalculation } from "@/domain/macros/types";
import { AppError } from "@/lib/errors";
import { inTransaction, type ServiceContext } from "@/server/context";
import { goalProfiles } from "@/server/db/schema";
import {
  computeTargetColumns,
  loadActiveProfiles,
  loadOwnProfile,
  parseInput,
  runDomain,
  storedCalculationInput,
  type GoalProfileRow,
  type TargetColumns,
} from "./internal";
import {
  CreateDerivedGoalProfileSchema,
  CreateGoalProfileSchema,
  GoalProfileIdSchema,
  UpdateGoalProfileSchema,
  UpsertDefaultGoalProfileSchema,
  WeekdaysSchema,
  type CreateDerivedGoalProfileInput,
  type CreateGoalProfileInput,
  type UpdateGoalProfileInput,
  type UpsertDefaultGoalProfileInput,
} from "./schemas";

/** Result of every write that touches targets: the row plus the "these macros equal X kcal" payload. */
export interface GoalProfileWriteResult {
  profile: GoalProfileRow;
  /** kcal, fitted grams, macroKcal, diffKcal, effective percents and friendly warnings. */
  calculation: MacroCalculation;
}

const DEFAULT_PROFILE_NAME = "Standard";
const MSG_ARCHIVED = "Archivierte Profile können nicht mehr bearbeitet werden.";
const MSG_DEFAULT_WEEKDAYS =
  "Dein Standardprofil gilt automatisch an allen Tagen ohne eigenes Profil, deshalb werden ihm keine Wochentage zugeordnet.";
const MSG_NO_DEFAULT = "Lege zuerst dein Standardziel fest.";

// ── Reads ───────────────────────────────────────────────────────────────────

/** The user's profiles: default first, then by creation. Archived ones only on request. */
export async function listGoalProfiles(
  ctx: ServiceContext,
  opts: { includeArchived?: boolean } = {},
): Promise<GoalProfileRow[]> {
  if (!opts.includeArchived) return loadActiveProfiles(ctx);
  return ctx.db
    .select()
    .from(goalProfiles)
    .where(eq(goalProfiles.userId, ctx.userId))
    .orderBy(
      sql`${goalProfiles.archivedAt} is not null`,
      sql`${goalProfiles.isDefault} desc`,
      goalProfiles.createdAt,
      goalProfiles.id,
    );
}

/** One of the user's profiles (archived included, e.g. for history). NOT_FOUND for foreign ids. */
export async function getGoalProfile(ctx: ServiceContext, id: string): Promise<GoalProfileRow> {
  return loadOwnProfile(ctx, parseInput(GoalProfileIdSchema, id));
}

/** The active default profile, or null before onboarding created one. */
export async function getDefaultGoalProfile(ctx: ServiceContext): Promise<GoalProfileRow | null> {
  const [row] = await ctx.db
    .select()
    .from(goalProfiles)
    .where(
      and(
        eq(goalProfiles.userId, ctx.userId),
        eq(goalProfiles.isDefault, true),
        isNull(goalProfiles.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ── Default profile ─────────────────────────────────────────────────────────

/**
 * Creates or updates the default profile (onboarding + settings). Grams are always derived via
 * the Macro Engine, so 4P + 4C + 9F is within ±5 kcal of `calorieTarget`.
 *
 *   await upsertDefaultGoalProfile(ctx, {
 *     calorieTarget: 2000, calorieSource: "calculated", macroMode: "percent",
 *     percents: { protein: 30, carbs: 40, fat: 30 },
 *   }); // → 150 P / 199 C / 67 F = 1999 kcal
 *
 * Atomic single-statement upsert against the partial unique index "one default per user".
 */
export async function upsertDefaultGoalProfile(
  ctx: ServiceContext,
  input: UpsertDefaultGoalProfileInput,
): Promise<GoalProfileWriteResult> {
  const parsed = parseInput(UpsertDefaultGoalProfileSchema, input);
  const { columns, calculation } = await computeTargetColumns(ctx, parsed);
  const [profile] = await ctx.db
    .insert(goalProfiles)
    .values({
      ...columns,
      userId: ctx.userId,
      name: parsed.name ?? DEFAULT_PROFILE_NAME,
      kind: "default",
      isDefault: true,
      weekdays: [],
    })
    .onConflictDoUpdate({
      target: goalProfiles.userId,
      targetWhere: sql`${goalProfiles.isDefault} = true and ${goalProfiles.archivedAt} is null`,
      set: { ...columns, ...(parsed.name ? { name: parsed.name } : {}), updatedAt: new Date() },
    })
    .returning();
  return { profile, calculation };
}

// ── Additional (day) profiles ───────────────────────────────────────────────

/**
 * Creates an additional profile (Trainingstag, Ruhetag, …) with its own targets and optional
 * weekdays. Requires an existing default profile. Weekday overlap → AppError("CONFLICT").
 *
 *   await createGoalProfile(ctx, {
 *     name: "Trainingstag", kind: "training", weekdays: [1, 3, 5],
 *     calorieTarget: 2550, calorieSource: "manual", macroMode: "grams",
 *     grams: { proteinG: 150, fatG: 64 },
 *   }); // → 150 P / 344 C / 64 F = 2552 kcal
 */
export async function createGoalProfile(
  ctx: ServiceContext,
  input: CreateGoalProfileInput,
): Promise<GoalProfileWriteResult> {
  const parsed = parseInput(CreateGoalProfileSchema, input);
  const weekdays = runDomain(() => normalizeWeekdays(parsed.weekdays));
  const { columns, calculation } = await computeTargetColumns(ctx, parsed);
  const profile = await insertDayProfile(ctx, { name: parsed.name, kind: parsed.kind, weekdays, columns });
  return { profile, calculation };
}

/**
 * Creates a day profile derived from the default profile via `deriveDayProfile` (protein fixed,
 * kcal delta and fat→carb shift per kind). Stored in grams mode, calorieSource "manual" (so a
 * recalculation of the default by the Calorie Engine doesn't silently overwrite the delta).
 * Fiber/sugar/sodium targets are copied from the default.
 *
 *   await createDerivedGoalProfile(ctx, { kind: "training", weekdays: [1, 3, 5] });
 *   // default 2300 kcal 150/281/64 → „Trainingstag“ 2550 kcal 150/344/64
 */
export async function createDerivedGoalProfile(
  ctx: ServiceContext,
  input: CreateDerivedGoalProfileInput,
): Promise<GoalProfileWriteResult> {
  const parsed = parseInput(CreateDerivedGoalProfileSchema, input);
  const weekdays = runDomain(() => normalizeWeekdays(parsed.weekdays));
  const base = await getDefaultGoalProfile(ctx);
  if (!base) throw new AppError("VALIDATION", MSG_NO_DEFAULT);
  const derived = runDomain(() =>
    deriveDayProfile(base, parsed.kind, {
      kcalDelta: parsed.kcalDelta,
      fatShiftKcal: parsed.fatShiftKcal,
      maintenanceKcal: parsed.maintenanceKcal,
      name: parsed.name,
    }),
  );
  const columns: TargetColumns = {
    calorieTarget: derived.calorieTarget,
    calorieSource: "manual",
    macroMode: "grams",
    ...derived.calculation.macros,
    proteinPct: null,
    carbsPct: null,
    fatPct: null,
    fiberG: base.fiberG,
    sugarMaxG: base.sugarMaxG,
    sodiumMaxMg: base.sodiumMaxMg,
  };
  const profile = await insertDayProfile(ctx, { name: derived.name, kind: derived.kind, weekdays, columns });
  return { profile, calculation: derived.calculation };
}

async function insertDayProfile(
  ctx: ServiceContext,
  p: { name: string; kind: GoalProfileRow["kind"]; weekdays: number[]; columns: TargetColumns },
): Promise<GoalProfileRow> {
  return inTransaction(ctx, async (tx) => {
    const active = await loadActiveProfiles(tx, { lock: true });
    if (!active.some((r) => r.isDefault)) throw new AppError("VALIDATION", MSG_NO_DEFAULT);
    assertNoWeekdayConflict(active, null, p.weekdays);
    const [row] = await tx.db
      .insert(goalProfiles)
      .values({
        ...p.columns,
        userId: tx.userId,
        name: p.name,
        kind: p.kind,
        isDefault: false,
        weekdays: p.weekdays,
      })
      .returning();
    return row;
  });
}

// ── Update / archive / schedule ─────────────────────────────────────────────

/**
 * Partial update of a profile (name, kind, weekdays, complete targets). The default profile keeps
 * kind "default" and has no weekdays. Archived profiles are read-only.
 */
export async function updateGoalProfile(
  ctx: ServiceContext,
  id: string,
  input: UpdateGoalProfileInput,
): Promise<GoalProfileWriteResult> {
  const profileId = parseInput(GoalProfileIdSchema, id);
  const parsed = parseInput(UpdateGoalProfileSchema, input);
  const weekdays = parsed.weekdays ? runDomain(() => normalizeWeekdays(parsed.weekdays!)) : undefined;
  const targets = parsed.targets ? await computeTargetColumns(ctx, parsed.targets) : undefined;

  return inTransaction(ctx, async (tx) => {
    const active = await loadActiveProfiles(tx, { lock: true });
    const current = active.find((r) => r.id === profileId) ?? (await loadOwnProfile(tx, profileId));
    if (current.archivedAt) throw new AppError("VALIDATION", MSG_ARCHIVED);
    if (current.isDefault && parsed.kind && parsed.kind !== current.kind) {
      throw new AppError("VALIDATION", "Die Art des Standardprofils lässt sich nicht ändern.", {
        kind: ["Die Art des Standardprofils lässt sich nicht ändern."],
      });
    }
    if (weekdays) {
      if (current.isDefault && weekdays.length > 0) {
        throw new AppError("VALIDATION", MSG_DEFAULT_WEEKDAYS, { weekdays: [MSG_DEFAULT_WEEKDAYS] });
      }
      assertNoWeekdayConflict(active, current.id, weekdays);
    }

    const [profile] = await tx.db
      .update(goalProfiles)
      .set({
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.kind !== undefined && !current.isDefault ? { kind: parsed.kind } : {}),
        ...(weekdays ? { weekdays } : {}),
        ...(targets?.columns ?? {}),
        updatedAt: new Date(),
      })
      .where(and(eq(goalProfiles.id, current.id), eq(goalProfiles.userId, tx.userId)))
      .returning();
    const s = storedCalculationInput(profile);
    return { profile, calculation: targets?.calculation ?? buildCalculation(s.kcal, s.macros) };
  });
}

/**
 * Archives a profile (soft delete: past daily_nutrition snapshots keep referencing it; overrides
 * to it fall back to schedule/default). The default profile can't be archived → VALIDATION.
 * Idempotent for already archived profiles.
 */
export async function archiveGoalProfile(ctx: ServiceContext, id: string): Promise<GoalProfileRow> {
  const profileId = parseInput(GoalProfileIdSchema, id);
  return inTransaction(ctx, async (tx) => {
    const current = await loadOwnProfile(tx, profileId, { forUpdate: true });
    if (current.isDefault) {
      throw new AppError(
        "VALIDATION",
        "Dein Standardprofil kann nicht archiviert werden, du kannst es aber jederzeit anpassen.",
      );
    }
    if (current.archivedAt) return current;
    const [row] = await tx.db
      .update(goalProfiles)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(goalProfiles.id, current.id), eq(goalProfiles.userId, tx.userId)))
      .returning();
    return row;
  });
}

/**
 * Replaces the weekdays (ISO 1 = Mo … 7 = So) a profile applies to automatically. Deduped/sorted.
 * A weekday may belong to only one active profile → AppError("CONFLICT") with a German message
 * like „Montag ist bereits dem Profil „Ruhetag“ zugeordnet. Entferne den Tag dort zuerst.“
 */
export async function setProfileWeekdays(
  ctx: ServiceContext,
  id: string,
  weekdays: readonly number[],
): Promise<GoalProfileRow> {
  const profileId = parseInput(GoalProfileIdSchema, id);
  const days = runDomain(() => normalizeWeekdays(parseInput(WeekdaysSchema, weekdays)));
  return inTransaction(ctx, async (tx) => {
    const active = await loadActiveProfiles(tx, { lock: true });
    const current = active.find((r) => r.id === profileId) ?? (await loadOwnProfile(tx, profileId));
    if (current.archivedAt) throw new AppError("VALIDATION", MSG_ARCHIVED);
    if (current.isDefault && days.length > 0) {
      throw new AppError("VALIDATION", MSG_DEFAULT_WEEKDAYS, { weekdays: [MSG_DEFAULT_WEEKDAYS] });
    }
    assertNoWeekdayConflict(active, current.id, days);
    const [row] = await tx.db
      .update(goalProfiles)
      .set({ weekdays: days, updatedAt: new Date() })
      .where(and(eq(goalProfiles.id, current.id), eq(goalProfiles.userId, tx.userId)))
      .returning();
    return row;
  });
}

function assertNoWeekdayConflict(active: GoalProfileRow[], candidateId: string | null, weekdays: number[]) {
  if (weekdays.length === 0) return;
  const conflicts = findWeekdayConflicts(
    active.filter((r) => !r.isDefault),
    candidateId,
    weekdays,
  );
  if (conflicts.length > 0) {
    const message = describeWeekdayConflicts(conflicts);
    throw new AppError("CONFLICT", message, { weekdays: [message] });
  }
}
