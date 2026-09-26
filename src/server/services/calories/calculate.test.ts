import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import { createTestGoalProfile, createTestWeightEntry } from "@/test/factories";
import { addDays, todayInTimezone } from "@/lib/dates";
import type { Db } from "@/server/db/create";
import { goalProfiles } from "@/server/db/schema";
import { getProfile } from "@/server/services/profile";
import { calculateCaloriesForUser, recalculateAndStore } from "./index";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

/** Birth date that makes the user exactly `age` years old today (1 Jan of the matching year). */
const bornYearsAgo = (age: number) => `${Number(todayInTimezone("Europe/Berlin").slice(0, 4)) - age}-01-01`;

/** Reference person: male, 30 y, 180 cm, 80 kg → Mifflin BMR 1780 kcal. */
const jonas = () => ({
  sex: "male" as const,
  birthDate: bornYearsAgo(30),
  heightCm: 180,
  startWeightKg: 80,
  activityLevel: "moderate" as const,
});

describe("calculateCaloriesForUser", () => {
  it("computes from the stored profile (maintain)", async () => {
    const ctx = await createTestUser(db, jonas());
    const calc = await calculateCaloriesForUser(ctx);
    expect(calc.calculatorId).toBe("mifflin_st_jeor");
    expect(calc.bmr).toBeCloseTo(1780, 6);
    expect(calc.tdee).toBeCloseTo(1780 * 1.55, 6);
    expect(calc.adjustment).toBe(0);
    expect(calc.target).toBe(2760);
    expect(calc.input).toMatchObject({ weightSource: "start", body: { ageYears: 30, weightKg: 80 } });
  });

  it("uses the latest weight entry and applies the goal", async () => {
    const ctx = await createTestUser(db, { ...jonas(), goalType: "lose", goalPace: "moderate", targetWeightKg: 75 });
    await createTestWeightEntry(ctx, { date: addDays(todayInTimezone(ctx.timezone), -1), weightKg: 84 });
    const calc = await calculateCaloriesForUser(ctx);
    // 10·84 + 6.25·180 − 5·30 + 5 = 1820; × 1.55 = 2821; − 500 = 2321 → 2320
    expect(calc.bmr).toBeCloseTo(1820, 6);
    expect(calc.adjustment).toBe(-500);
    expect(calc.target).toBe(2320);
    expect(calc.weeklyChangeKg).toBeCloseTo((-500 * 7) / 7700, 6);
    expect(calc.estimatedWeeksToGoal).toBe(Math.ceil(9 / ((500 * 7) / 7700)));
    expect(calc.input.weightSource).toBe("entry");
  });

  it("overrides win over stored data (onboarding preview) and nothing is written", async () => {
    const ctx = await createTestUser(db);
    const calc = await calculateCaloriesForUser(ctx, {
      sex: "female",
      ageYears: 25,
      heightCm: 165,
      weightKg: 60,
      activityLevel: "sedentary",
      goalType: "maintain",
    });
    expect(calc.bmr).toBeCloseTo(1345.25, 6); // 600 + 1031.25 − 125 − 161
    expect(calc.tdee).toBeCloseTo(1345.25 * 1.2, 6);
    expect(calc.input.weightSource).toBe("override");
    const row = await getProfile(ctx);
    expect(row.bmrKcal).toBeNull();
    expect(row.heightCm).toBeNull();
  });

  it("reports all missing data at once in German", async () => {
    const ctx = await createTestUser(db);
    await expect(calculateCaloriesForUser(ctx)).rejects.toMatchObject({
      code: "VALIDATION",
      message: "Für die Berechnung fehlen noch ein paar Angaben.",
      fieldErrors: {
        birthDate: [expect.stringContaining("Geburtsdatum")],
        heightCm: [expect.stringContaining("Größe")],
        weightKg: [expect.stringContaining("Gewicht")],
      },
    });
  });

  it("rejects invalid overrides", async () => {
    const ctx = await createTestUser(db, jonas());
    await expect(calculateCaloriesForUser(ctx, { heightCm: 20 })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { heightCm: [expect.any(String)] },
    });
  });

  it("uses the stored calculator and falls back when Katch-McArdle lacks body fat", async () => {
    const ctx = await createTestUser(db, { ...jonas(), calculatorId: "katch_mcardle" });
    const fallback = await calculateCaloriesForUser(ctx);
    expect(fallback.calculatorId).toBe("mifflin_st_jeor");
    expect(fallback.warningDetails.map((w) => w.code)).toContain("calculator_fallback");

    await createTestWeightEntry(ctx, { date: addDays(todayInTimezone(ctx.timezone), -1), weightKg: 80, bodyFatPct: 20 });
    const katch = await calculateCaloriesForUser(ctx);
    expect(katch.calculatorId).toBe("katch_mcardle");
    expect(katch.bmr).toBeCloseTo(370 + 21.6 * 64, 6); // lean mass 64 kg
  });

  it("applies safety floors with a German warning", async () => {
    const ctx = await createTestUser(db, {
      sex: "female",
      birthDate: bornYearsAgo(60),
      heightCm: 150,
      startWeightKg: 45,
      activityLevel: "sedentary",
      goalType: "lose",
      goalPace: "fast",
    });
    const calc = await calculateCaloriesForUser(ctx);
    // BMR 926.5, TDEE ≈ 1112 → deficit capped to 25 %, then raised to the floor
    expect(calc.capApplied).toBe(true);
    expect(calc.floorApplied).toBe(true);
    expect(calc.target).toBe(calc.floorKcal);
    expect(calc.warningDetails.map((w) => w.code)).toContain("floor_applied");
  });
});

describe("recalculateAndStore", () => {
  it("writes rounded BMR/TDEE for the user only and leaves goal profiles alone", async () => {
    const ctx = await createTestUser(db, jonas());
    const other = await createTestUser(db, jonas());
    const goal = await createTestGoalProfile(ctx, { calorieTarget: 1900 });

    const calc = await recalculateAndStore(ctx);
    expect(calc.target).toBe(2760);
    const row = await getProfile(ctx);
    expect(row.bmrKcal).toBe(1780);
    expect(row.tdeeKcal).toBe(2759);
    expect((await getProfile(other)).bmrKcal).toBeNull();

    const [goalRow] = await db.select().from(goalProfiles).where(eq(goalProfiles.id, goal.id));
    expect(goalRow.calorieTarget).toBe(1900);
  });

  it("throws VALIDATION and writes nothing when data is missing", async () => {
    const ctx = await createTestUser(db, { heightCm: 180 });
    await expect(recalculateAndStore(ctx)).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await getProfile(ctx)).tdeeKcal).toBeNull();
  });
});
