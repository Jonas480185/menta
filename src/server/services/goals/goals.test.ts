import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { MACRO_KCAL_TOLERANCE } from "@/domain/macros/math";
import { AppError } from "@/lib/errors";
import type { ServiceContext } from "@/server/context";
import type { Db } from "@/server/db/create";
import { dailyNutrition, goalProfiles, userProfiles } from "@/server/db/schema";
import { createTestDb, createTestUser } from "@/test/db";
import { createTestGoalProfile, createTestWeightEntry } from "@/test/factories";
import {
  archiveGoalProfile,
  createDerivedGoalProfile,
  createGoalProfile,
  getDefaultGoalProfile,
  getGoalProfile,
  listGoalProfiles,
  resolveGoalProfileForDate,
  resolveGoalProfilesForRange,
  setProfileWeekdays,
  updateGoalProfile,
  upsertDefaultGoalProfile,
  type GoalProfileRow,
} from "./index";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

// 2026-09-28 is a Monday (ISO 1), 2026-09-30 a Wednesday (3), 2026-10-04 a Sunday (7).
const MONDAY = "2026-09-28";
const WEDNESDAY = "2026-09-30";
const SUNDAY = "2026-10-04";

const kcalOf = (p: Pick<GoalProfileRow, "proteinG" | "carbsG" | "fatG">) =>
  p.proteinG * 4 + p.carbsG * 4 + p.fatG * 9;

function expectConsistent(p: GoalProfileRow) {
  expect(Math.abs(kcalOf(p) - p.calorieTarget)).toBeLessThanOrEqual(MACRO_KCAL_TOLERANCE);
  for (const g of [p.proteinG, p.carbsG, p.fatG]) expect(Number.isInteger(g)).toBe(true);
}

async function setupDefault(ctx: ServiceContext, calorieTarget = 2300) {
  const { profile } = await upsertDefaultGoalProfile(ctx, {
    calorieTarget,
    calorieSource: "calculated",
    macroMode: "grams",
    grams: { proteinG: 150, fatG: 64 },
  });
  return profile;
}

async function overrideDay(ctx: ServiceContext, date: string, profileId: string | null) {
  await ctx.db.insert(dailyNutrition).values({
    userId: ctx.userId,
    date,
    goalProfileId: profileId,
    profileOverridden: true,
    targetCalories: 2000,
    targetProteinG: 150,
    targetCarbsG: 200,
    targetFatG: 67,
  });
}

const dayProfile = (name: string, weekdays: number[] = []) => ({
  name,
  kind: "custom" as const,
  weekdays,
  calorieTarget: 2500,
  calorieSource: "manual" as const,
  macroMode: "grams" as const,
  grams: { proteinG: 150, fatG: 70 },
});

describe("upsertDefaultGoalProfile – persistence consistency", () => {
  it("percent mode: stores fitted grams + the user's percents (4P+4C+9F ≈ target)", async () => {
    const ctx = await createTestUser(db);
    const { profile, calculation } = await upsertDefaultGoalProfile(ctx, {
      calorieTarget: 2000,
      calorieSource: "calculated",
      macroMode: "percent",
      percents: { protein: 30, carbs: 40, fat: 30 },
    });
    expect(profile).toMatchObject({
      isDefault: true,
      kind: "default",
      name: "Standard",
      macroMode: "percent",
      proteinG: 150,
      carbsG: 199,
      fatG: 67,
      proteinPct: 30,
      carbsPct: 40,
      fatPct: 30,
    });
    expectConsistent(profile);
    expect(calculation.macroKcal).toBe(1999);
    expect(calculation.diffKcal).toBe(-1);
  });

  it("grams mode: protein & fat fixed, carbs fill the rest, percents null", async () => {
    const ctx = await createTestUser(db);
    const { profile } = await upsertDefaultGoalProfile(ctx, {
      calorieTarget: 2400,
      calorieSource: "manual",
      macroMode: "grams",
      grams: { proteinG: 180, fatG: 70 },
    });
    expect(profile).toMatchObject({
      proteinG: 180,
      carbsG: 263,
      fatG: 70,
      proteinPct: null,
      calorieSource: "manual",
    });
    expectConsistent(profile);
  });

  it("grams mode: rejects protein + fat above the calorie target", async () => {
    const ctx = await createTestUser(db);
    await expect(
      upsertDefaultGoalProfile(ctx, {
        calorieTarget: 1500,
        calorieSource: "manual",
        macroMode: "grams",
        grams: { proteinG: 200, fatG: 100 },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { grams: [expect.any(String)] } });
  });

  it("auto mode: uses the explicit input", async () => {
    const ctx = await createTestUser(db);
    const { profile, calculation } = await upsertDefaultGoalProfile(ctx, {
      calorieTarget: 2200,
      calorieSource: "calculated",
      macroMode: "auto",
      autoInput: { weightKg: 80, goal: "lose", activityLevel: "moderate" },
    });
    expect(profile.macroMode).toBe("auto");
    expect(profile.proteinG).toBe(160); // 2.0 g/kg × 80 kg
    expect(profile.proteinPct).toBeNull();
    expectConsistent(profile);
    expect(calculation.kcal).toBe(2200);
  });

  it("auto mode: falls back to user profile + latest weight entry", async () => {
    const ctx = await createTestUser(db, { goalType: "maintain", activityLevel: "moderate" });
    await createTestWeightEntry(ctx, { date: "2026-09-01", weightKg: 90 });
    await createTestWeightEntry(ctx, { date: "2026-09-20", weightKg: 75 });
    const { profile } = await upsertDefaultGoalProfile(ctx, {
      calorieTarget: 2400,
      calorieSource: "calculated",
      macroMode: "auto",
    });
    expect(profile.proteinG).toBe(120); // 1.6 g/kg × 75 kg (latest entry)
    expectConsistent(profile);
  });

  it("auto mode without any weight → VALIDATION on autoInput.weightKg", async () => {
    const ctx = await createTestUser(db);
    await expect(
      upsertDefaultGoalProfile(ctx, { calorieTarget: 2000, calorieSource: "calculated", macroMode: "auto" }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { "autoInput.weightKg": [expect.any(String)] },
    });
  });

  it("validates input (percent sum, missing payload, kcal range)", async () => {
    const ctx = await createTestUser(db);
    await expect(
      upsertDefaultGoalProfile(ctx, {
        calorieTarget: 2000,
        calorieSource: "manual",
        macroMode: "percent",
        percents: { protein: 30, carbs: 30, fat: 30 },
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { percents: [expect.stringContaining("100 %")] },
    });
    await expect(
      upsertDefaultGoalProfile(ctx, { calorieTarget: 2000, calorieSource: "manual", macroMode: "percent" }),
    ).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { percents: [expect.any(String)] } });
    await expect(
      upsertDefaultGoalProfile(ctx, {
        calorieTarget: 0,
        calorieSource: "manual",
        macroMode: "grams",
        grams: { proteinG: 100, fatG: 50 },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("updates the existing default instead of creating a second one (uniqueness)", async () => {
    const ctx = await createTestUser(db);
    const first = await setupDefault(ctx, 2300);
    const { profile: second } = await upsertDefaultGoalProfile(ctx, {
      calorieTarget: 2100,
      calorieSource: "manual",
      macroMode: "percent",
      percents: { protein: 35, carbs: 40, fat: 25 },
      fiberG: 30,
    });
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ calorieTarget: 2100, macroMode: "percent", proteinPct: 35, fiberG: 30 });
    expectConsistent(second);
    const defaults = (await listGoalProfiles(ctx)).filter((p) => p.isDefault);
    expect(defaults).toHaveLength(1);

    // undefined keeps the fiber target, null clears it
    const { profile: kept } = await upsertDefaultGoalProfile(ctx, {
      calorieTarget: 2100,
      calorieSource: "manual",
      macroMode: "grams",
      grams: { proteinG: 150, fatG: 60 },
    });
    expect(kept.fiberG).toBe(30);
    expect(kept.proteinPct).toBeNull();
    const { profile: cleared } = await upsertDefaultGoalProfile(ctx, {
      calorieTarget: 2100,
      calorieSource: "manual",
      macroMode: "grams",
      grams: { proteinG: 150, fatG: 60 },
      fiberG: null,
    });
    expect(cleared.fiberG).toBeNull();
  });

  it("the database refuses a second active default", async () => {
    const ctx = await createTestUser(db);
    await setupDefault(ctx);
    await expect(createTestGoalProfile(ctx, { isDefault: true })).rejects.toThrow();
  });
});

describe("reads", () => {
  it("getDefaultGoalProfile returns null before onboarding", async () => {
    const ctx = await createTestUser(db);
    expect(await getDefaultGoalProfile(ctx)).toBeNull();
    expect(await listGoalProfiles(ctx)).toEqual([]);
  });

  it("lists default first; archived only on request; getGoalProfile includes archived", async () => {
    const ctx = await createTestUser(db);
    const def = await setupDefault(ctx);
    const { profile: a } = await createGoalProfile(ctx, dayProfile("Trainingstag"));
    const { profile: b } = await createGoalProfile(ctx, dayProfile("Ruhetag"));
    await archiveGoalProfile(ctx, a.id);

    expect((await listGoalProfiles(ctx)).map((p) => p.id)).toEqual([def.id, b.id]);
    expect((await listGoalProfiles(ctx, { includeArchived: true })).map((p) => p.id)).toEqual([
      def.id,
      b.id,
      a.id,
    ]);
    expect((await getGoalProfile(ctx, a.id)).archivedAt).not.toBeNull();
    expect((await getDefaultGoalProfile(ctx))?.id).toBe(def.id);
  });

  it("getGoalProfile: invalid id → VALIDATION, unknown id → NOT_FOUND", async () => {
    const ctx = await createTestUser(db);
    await expect(getGoalProfile(ctx, "nope")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(getGoalProfile(ctx, crypto.randomUUID())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("createGoalProfile / createDerivedGoalProfile", () => {
  it("requires a default profile first", async () => {
    const ctx = await createTestUser(db);
    await expect(createGoalProfile(ctx, dayProfile("Trainingstag"))).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(createDerivedGoalProfile(ctx, { kind: "training" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("creates a consistent non-default profile with normalized weekdays", async () => {
    const ctx = await createTestUser(db);
    await setupDefault(ctx);
    const { profile, calculation } = await createGoalProfile(ctx, {
      ...dayProfile("Trainingstag", [5, 1, 3, 1]),
      kind: "training",
    });
    expect(profile).toMatchObject({
      isDefault: false,
      kind: "training",
      weekdays: [1, 3, 5],
      name: "Trainingstag",
    });
    expectConsistent(profile);
    expect(calculation.macros).toEqual({
      proteinG: profile.proteinG,
      carbsG: profile.carbsG,
      fatG: profile.fatG,
    });
  });

  it('rejects the reserved kind "default" and blank names', async () => {
    const ctx = await createTestUser(db);
    await setupDefault(ctx);
    await expect(
      createGoalProfile(ctx, { ...dayProfile("X"), kind: "default" as never }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createGoalProfile(ctx, dayProfile("   "))).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { name: [expect.any(String)] },
    });
  });

  it("derives a training day from the default (protein fixed, +250 kcal from carbs)", async () => {
    const ctx = await createTestUser(db);
    const base = await setupDefault(ctx, 2300); // 150 P / 281 C / 64 F
    expect(base.carbsG).toBe(281);
    await updateGoalProfile(ctx, base.id, {
      targets: {
        calorieTarget: 2300,
        calorieSource: "calculated",
        macroMode: "grams",
        grams: { proteinG: 150, fatG: 64 },
        fiberG: 30,
      },
    });
    const { profile, calculation } = await createDerivedGoalProfile(ctx, {
      kind: "training",
      weekdays: [1, 3, 5],
    });
    expect(profile).toMatchObject({
      name: "Trainingstag",
      kind: "training",
      calorieTarget: 2550,
      calorieSource: "manual",
      macroMode: "grams",
      proteinG: 150,
      carbsG: 344,
      fatG: 64,
      fiberG: 30,
      weekdays: [1, 3, 5],
    });
    expectConsistent(profile);
    expect(calculation.kcal).toBe(2550);
  });
});

describe("archiveGoalProfile", () => {
  it("cannot archive the default profile", async () => {
    const ctx = await createTestUser(db);
    const def = await setupDefault(ctx);
    await expect(archiveGoalProfile(ctx, def.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("archives (idempotently) and makes the profile read-only", async () => {
    const ctx = await createTestUser(db);
    await setupDefault(ctx);
    const { profile } = await createGoalProfile(ctx, dayProfile("Refeed", [6]));
    const archived = await archiveGoalProfile(ctx, profile.id);
    expect(archived.archivedAt).toBeInstanceOf(Date);
    const again = await archiveGoalProfile(ctx, profile.id);
    expect(again.archivedAt?.getTime()).toBe(archived.archivedAt?.getTime());
    await expect(updateGoalProfile(ctx, profile.id, { name: "Neu" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(setProfileWeekdays(ctx, profile.id, [2])).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("frees the weekdays of an archived profile for others", async () => {
    const ctx = await createTestUser(db);
    await setupDefault(ctx);
    const { profile: a } = await createGoalProfile(ctx, dayProfile("A", [1]));
    await archiveGoalProfile(ctx, a.id);
    const { profile: b } = await createGoalProfile(ctx, dayProfile("B", [1]));
    expect(b.weekdays).toEqual([1]);
  });
});

describe("weekday schedule", () => {
  it("rejects overlap with another active profile (CONFLICT, German message)", async () => {
    const ctx = await createTestUser(db);
    await setupDefault(ctx);
    await createGoalProfile(ctx, dayProfile("Ruhetag", [1, 3]));
    const { profile: training } = await createGoalProfile(ctx, dayProfile("Trainingstag", [2]));

    const err = await setProfileWeekdays(ctx, training.id, [1, 2, 3]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({
      code: "CONFLICT",
      message:
        "Montag und Mittwoch sind bereits dem Profil „Ruhetag“ zugeordnet. Entferne die Tage dort zuerst.",
    });
    await expect(createGoalProfile(ctx, dayProfile("Noch eins", [3]))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(updateGoalProfile(ctx, training.id, { weekdays: [1] })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    // unchanged after the failed attempts
    expect((await getGoalProfile(ctx, training.id)).weekdays).toEqual([2]);
  });

  it("sets, dedupes, re-sets own days and clears", async () => {
    const ctx = await createTestUser(db);
    await setupDefault(ctx);
    const { profile } = await createGoalProfile(ctx, dayProfile("Training", [1]));
    expect((await setProfileWeekdays(ctx, profile.id, [7, 1, 1, 4])).weekdays).toEqual([1, 4, 7]);
    expect((await setProfileWeekdays(ctx, profile.id, [])).weekdays).toEqual([]);
  });

  it("rejects invalid weekdays and weekdays on the default profile", async () => {
    const ctx = await createTestUser(db);
    const def = await setupDefault(ctx);
    const { profile } = await createGoalProfile(ctx, dayProfile("Training"));
    await expect(setProfileWeekdays(ctx, profile.id, [0])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setProfileWeekdays(ctx, profile.id, [8])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setProfileWeekdays(ctx, def.id, [1])).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await setProfileWeekdays(ctx, def.id, [])).weekdays).toEqual([]);
  });
});

describe("updateGoalProfile", () => {
  it("updates name/kind/targets consistently and returns the calculation", async () => {
    const ctx = await createTestUser(db);
    await setupDefault(ctx);
    const { profile } = await createGoalProfile(ctx, dayProfile("Alt"));
    const { profile: updated, calculation } = await updateGoalProfile(ctx, profile.id, {
      name: "Ruhetag",
      kind: "rest",
      targets: {
        calorieTarget: 1900,
        calorieSource: "manual",
        macroMode: "percent",
        percents: { protein: 33.3, carbs: 33.3, fat: 33.4 },
      },
    });
    expect(updated).toMatchObject({
      name: "Ruhetag",
      kind: "rest",
      calorieTarget: 1900,
      macroMode: "percent",
    });
    expectConsistent(updated);
    expect(calculation.kcal).toBe(1900);

    // name-only update keeps targets, calculation is rebuilt from the stored grams
    const { profile: renamed, calculation: c2 } = await updateGoalProfile(ctx, profile.id, { name: "Chill" });
    expect(renamed).toMatchObject({ name: "Chill", proteinG: updated.proteinG, carbsG: updated.carbsG });
    expect(c2.macroKcal).toBe(kcalOf(updated));
  });

  it("the default profile keeps its kind", async () => {
    const ctx = await createTestUser(db);
    const def = await setupDefault(ctx);
    await expect(updateGoalProfile(ctx, def.id, { kind: "training" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const { profile } = await updateGoalProfile(ctx, def.id, { name: "Mein Ziel" });
    expect(profile).toMatchObject({ name: "Mein Ziel", kind: "default", isDefault: true });
  });
});

describe("user isolation", () => {
  it("cannot read, update, archive or schedule another user's profile", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    await setupDefault(alice);
    await setupDefault(bob);
    const { profile } = await createGoalProfile(alice, dayProfile("Alice", [1]));

    await expect(getGoalProfile(bob, profile.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateGoalProfile(bob, profile.id, { name: "Hack" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(archiveGoalProfile(bob, profile.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setProfileWeekdays(bob, profile.id, [2])).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listGoalProfiles(bob)).some((p) => p.id === profile.id)).toBe(false);

    // Alice's Monday doesn't block Bob's Monday
    const { profile: bobs } = await createGoalProfile(bob, dayProfile("Bob", [1]));
    expect(bobs.weekdays).toEqual([1]);
    // and doesn't leak into Bob's resolution
    expect((await resolveGoalProfileForDate(bob, MONDAY))?.id).toBe(bobs.id);
  });

  it("an override row pointing at a foreign profile is ignored", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    const bobDefault = await setupDefault(bob);
    await setupDefault(alice);
    const { profile: alices } = await createGoalProfile(alice, dayProfile("Alice"));
    await overrideDay(bob, MONDAY, alices.id);
    expect((await resolveGoalProfileForDate(bob, MONDAY))?.id).toBe(bobDefault.id);
  });
});

describe("resolveGoalProfileForDate – precedence", () => {
  it("returns null without any profile", async () => {
    const ctx = await createTestUser(db);
    expect(await resolveGoalProfileForDate(ctx, MONDAY)).toBeNull();
  });

  it("override > weekday schedule > default", async () => {
    const ctx = await createTestUser(db);
    const def = await setupDefault(ctx);
    const { profile: training } = await createGoalProfile(ctx, dayProfile("Training", [1, 3]));
    const { profile: refeed } = await createGoalProfile(ctx, dayProfile("Refeed"));

    expect((await resolveGoalProfileForDate(ctx, MONDAY))?.id).toBe(training.id);
    expect((await resolveGoalProfileForDate(ctx, SUNDAY))?.id).toBe(def.id);

    await overrideDay(ctx, WEDNESDAY, refeed.id);
    expect((await resolveGoalProfileForDate(ctx, WEDNESDAY))?.id).toBe(refeed.id);
    // an override to the default beats the schedule too
    await overrideDay(ctx, MONDAY, def.id);
    expect((await resolveGoalProfileForDate(ctx, MONDAY))?.id).toBe(def.id);
  });

  it("an archived override falls back to schedule, then default", async () => {
    const ctx = await createTestUser(db);
    const def = await setupDefault(ctx);
    const { profile: training } = await createGoalProfile(ctx, dayProfile("Training", [1]));
    const { profile: refeed } = await createGoalProfile(ctx, dayProfile("Refeed"));
    await overrideDay(ctx, MONDAY, refeed.id);
    await overrideDay(ctx, SUNDAY, refeed.id);
    await archiveGoalProfile(ctx, refeed.id);

    expect((await resolveGoalProfileForDate(ctx, MONDAY))?.id).toBe(training.id);
    expect((await resolveGoalProfileForDate(ctx, SUNDAY))?.id).toBe(def.id);
  });

  it("an override without profile (deleted → set null) or not flagged is ignored", async () => {
    const ctx = await createTestUser(db);
    const def = await setupDefault(ctx);
    const { profile: training } = await createGoalProfile(ctx, dayProfile("Training", [1]));
    await overrideDay(ctx, MONDAY, null);
    expect((await resolveGoalProfileForDate(ctx, MONDAY))?.id).toBe(training.id);

    const { profile: other } = await createGoalProfile(ctx, dayProfile("Anders"));
    await ctx.db.insert(dailyNutrition).values({
      userId: ctx.userId,
      date: SUNDAY,
      goalProfileId: other.id,
      profileOverridden: false,
      targetCalories: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 67,
    });
    expect((await resolveGoalProfileForDate(ctx, SUNDAY))?.id).toBe(def.id);
  });

  it("archived scheduled profiles don't apply", async () => {
    const ctx = await createTestUser(db);
    const def = await setupDefault(ctx);
    const { profile } = await createGoalProfile(ctx, dayProfile("Training", [1]));
    await archiveGoalProfile(ctx, profile.id);
    expect((await resolveGoalProfileForDate(ctx, MONDAY))?.id).toBe(def.id);
  });

  it("legacy overlapping data: the oldest scheduled profile wins", async () => {
    const ctx = await createTestUser(db);
    await setupDefault(ctx);
    const older = await createTestGoalProfile(ctx, {
      kind: "training",
      name: "Alt",
      weekdays: [1],
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    await createTestGoalProfile(ctx, {
      kind: "rest",
      name: "Neu",
      weekdays: [1],
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });
    expect((await resolveGoalProfileForDate(ctx, MONDAY))?.id).toBe(older.id);
  });

  it("rejects malformed dates", async () => {
    const ctx = await createTestUser(db);
    await expect(resolveGoalProfileForDate(ctx, "28.09.2026")).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("resolveGoalProfilesForRange", () => {
  it("matches the single-date resolution for every day of a week", async () => {
    const ctx = await createTestUser(db);
    const def = await setupDefault(ctx);
    const { profile: training } = await createGoalProfile(ctx, dayProfile("Training", [1, 3, 5]));
    const { profile: rest } = await createGoalProfile(ctx, dayProfile("Ruhe", [7]));
    const { profile: archived } = await createGoalProfile(ctx, dayProfile("Weg"));
    await overrideDay(ctx, WEDNESDAY, rest.id);
    await overrideDay(ctx, "2026-10-02", archived.id); // Friday
    await archiveGoalProfile(ctx, archived.id);

    const byDate = await resolveGoalProfilesForRange(ctx, MONDAY, SUNDAY);
    expect([...byDate.keys()]).toHaveLength(7);
    expect([...byDate.values()].map((p) => p?.id)).toEqual([
      training.id, // Mo schedule
      def.id, // Di
      rest.id, // Mi override
      def.id, // Do
      training.id, // Fr archived override → schedule
      def.id, // Sa
      rest.id, // So schedule
    ]);
    for (const [date, p] of byDate) {
      expect((await resolveGoalProfileForDate(ctx, date))?.id).toBe(p?.id);
    }
    expect((await resolveGoalProfilesForRange(ctx, SUNDAY, MONDAY)).size).toBe(0);
  });
});

describe("persistence invariant across modes", () => {
  it.each([
    { mode: "percent" as const, kcal: 1850, percents: { protein: 25, carbs: 5, fat: 70 } },
    { mode: "percent" as const, kcal: 3123, percents: { protein: 20, carbs: 55, fat: 25 } },
    { mode: "percent" as const, kcal: 1500, percents: { protein: 40, carbs: 0, fat: 60 } },
    { mode: "grams" as const, kcal: 2777, grams: { proteinG: 171.4, fatG: 77.6 } },
    { mode: "auto" as const, kcal: 1400, autoInput: { weightKg: 130, heightCm: 170, goal: "lose" as const } },
    {
      mode: "auto" as const,
      kcal: 3500,
      autoInput: { weightKg: 70, goal: "gain" as const, activityLevel: "very_active" as const },
    },
  ])("$mode @ $kcal kcal → 4P + 4C + 9F ≈ target (stored in DB)", async (c) => {
    const ctx = await createTestUser(db);
    const { profile } = await upsertDefaultGoalProfile(ctx, {
      calorieTarget: c.kcal,
      calorieSource: "manual",
      macroMode: c.mode,
      percents: "percents" in c ? c.percents : undefined,
      grams: "grams" in c ? c.grams : undefined,
      autoInput: "autoInput" in c ? c.autoInput : undefined,
    });
    const [stored] = await db.select().from(goalProfiles).where(eq(goalProfiles.id, profile.id));
    expectConsistent(stored);
  });

  it("uses the user profile's goal for auto mode when not given", async () => {
    const ctx = await createTestUser(db);
    await db
      .update(userProfiles)
      .set({ goalType: "lose", activityLevel: "moderate", startWeightKg: 80 })
      .where(eq(userProfiles.userId, ctx.userId));
    const { profile } = await upsertDefaultGoalProfile(ctx, {
      calorieTarget: 2000,
      calorieSource: "calculated",
      macroMode: "auto",
    });
    expect(profile.proteinG).toBe(160); // lose: 2.0 g/kg × start weight 80 kg
  });
});
