import { describe, expect, it } from "vitest";
import {
  CALCULATORS,
  DEFAULT_CALCULATOR_ID,
  defineCalculator,
  getCalculator,
  harrisBenedictRevised,
  isCalculatorId,
  katchMcArdle,
  mifflinStJeor,
} from "./calculators";
import { ACTIVITY_LEVELS, ACTIVITY_MULTIPLIERS } from "./constants";
import { CalorieInputError, isCalorieInputError } from "./errors";
import type { ActivityLevel, BodyProfile } from "./types";

/** Reference people – all expected values below are computed by hand. */
const male30: BodyProfile = { ageYears: 30, sex: "male", heightCm: 180, weightKg: 80, activityLevel: "moderate" };
const female25: BodyProfile = { ageYears: 25, sex: "female", heightCm: 165, weightKg: 60, activityLevel: "sedentary" };
const unspecified30: BodyProfile = { ...male30, sex: "unspecified" };
/** "Jonas", the reference user from docs/product/README.md. */
const jonas: BodyProfile = { ageYears: 33, sex: "male", heightCm: 180, weightKg: 84, activityLevel: "moderate" };

describe("mifflinStJeor", () => {
  it.each([
    // 10·80 + 6.25·180 − 5·30 + 5 = 800 + 1125 − 150 + 5
    ["male 30 y 180 cm 80 kg", male30, 1780],
    // 10·60 + 6.25·165 − 5·25 − 161 = 600 + 1031.25 − 125 − 161
    ["female 25 y 165 cm 60 kg", female25, 1345.25],
    // unspecified: s = (5 + −161) / 2 = −78 → 800 + 1125 − 150 − 78
    ["unspecified 30 y 180 cm 80 kg", unspecified30, 1697],
    // 840 + 1125 − 165 + 5 (docs reference user)
    ["Jonas 33 y 180 cm 84 kg", jonas, 1805],
  ])("BMR %s", (_, profile, expected) => {
    expect(mifflinStJeor.calculateBMR(profile)).toBeCloseTo(expected, 6);
  });

  it("unspecified sits exactly between male and female", () => {
    const male = mifflinStJeor.calculateBMR(male30);
    const female = mifflinStJeor.calculateBMR({ ...male30, sex: "female" });
    expect(mifflinStJeor.calculateBMR(unspecified30)).toBeCloseTo((male + female) / 2, 9);
  });

  it.each<[ActivityLevel, number]>([
    ["sedentary", 1780 * 1.2], // 2136
    ["light", 1780 * 1.375], // 2447.5
    ["moderate", 1780 * 1.55], // 2759
    ["active", 1780 * 1.725], // 3070.5
    ["very_active", 1780 * 1.9], // 3382
  ])("TDEE for %s", (activityLevel, expected) => {
    expect(mifflinStJeor.calculateTDEE({ ...male30, activityLevel })).toBeCloseTo(expected, 6);
  });

  it("ignores body fat", () => {
    expect(mifflinStJeor.calculateBMR({ ...male30, bodyFatPct: 12 })).toBe(1780);
  });
});

describe("harrisBenedictRevised", () => {
  it("male: 88.362 + 13.397·80 + 4.799·180 − 5.677·30 = 1853.632", () => {
    expect(harrisBenedictRevised.calculateBMR(male30)).toBeCloseTo(1853.632, 6);
  });
  it("female: 447.593 + 9.247·60 + 3.098·165 − 4.330·25 = 1405.333", () => {
    expect(harrisBenedictRevised.calculateBMR(female25)).toBeCloseTo(1405.333, 6);
  });
  it("unspecified: mean of male (1853.632) and female (1615.093) = 1734.3625", () => {
    expect(harrisBenedictRevised.calculateBMR(unspecified30)).toBeCloseTo(1734.3625, 6);
  });
});

describe("katchMcArdle", () => {
  it("370 + 21.6 · LBM (80 kg, 20 % → 64 kg) = 1752.4", () => {
    expect(katchMcArdle.calculateBMR({ ...male30, bodyFatPct: 20 })).toBeCloseTo(1752.4, 6);
  });
  it("is sex-independent", () => {
    expect(katchMcArdle.calculateBMR({ ...female25, weightKg: 80, bodyFatPct: 20 })).toBeCloseTo(1752.4, 6);
  });
  it.each([undefined, null, 1, 71, Number.NaN])("throws a clear error for body fat %s", (bodyFatPct) => {
    const profile = { ...male30, bodyFatPct };
    expect(katchMcArdle.canCalculate(profile)).toBe(false);
    expect(() => katchMcArdle.calculateBMR(profile)).toThrow(CalorieInputError);
    try {
      katchMcArdle.calculateBMR(profile);
    } catch (err) {
      expect(isCalorieInputError(err) && err.field).toBe("bodyFatPct");
      expect((err as Error).message).toMatch(/Körperfettanteil/);
    }
  });
  it("declares its extra requirement", () => {
    expect(katchMcArdle.requires).toEqual(["bodyFatPct"]);
    expect(mifflinStJeor.requires).toEqual([]);
  });
});

describe("input validation (all calculators)", () => {
  it.each<[string, Partial<BodyProfile>, string]>([
    ["height 0", { heightCm: 0 }, "heightCm"],
    ["height 301", { heightCm: 301 }, "heightCm"],
    ["weight 19", { weightKg: 19 }, "weightKg"],
    ["weight NaN", { weightKg: Number.NaN }, "weightKg"],
    ["age 13", { ageYears: 13 }, "ageYears"],
    ["age 121", { ageYears: 121 }, "ageYears"],
    ["bad sex", { sex: "x" as BodyProfile["sex"] }, "sex"],
    ["bad activity", { activityLevel: "couch" as ActivityLevel }, "activityLevel"],
  ])("rejects %s", (_, patch, field) => {
    for (const calculator of CALCULATORS) {
      expect(() => calculator.calculateBMR({ ...male30, bodyFatPct: 20, ...patch })).toThrow(
        expect.objectContaining({ name: "CalorieInputError", field }),
      );
    }
  });

  it("accepts the boundaries of the DB ranges", () => {
    expect(() => mifflinStJeor.calculateBMR({ ...male30, heightCm: 50, weightKg: 20 })).not.toThrow();
    expect(() => mifflinStJeor.calculateBMR({ ...male30, heightCm: 300, weightKg: 400 })).not.toThrow();
  });
});

describe("registry", () => {
  it("defaults to Mifflin-St Jeor", () => {
    expect(DEFAULT_CALCULATOR_ID).toBe("mifflin_st_jeor");
    expect(getCalculator()).toBe(mifflinStJeor);
    expect(CALCULATORS[0]).toBe(mifflinStJeor);
  });
  it("finds every calculator by id; ids are unique", () => {
    const ids = CALCULATORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CALCULATORS) {
      expect(getCalculator(c.id)).toBe(c);
      expect(isCalculatorId(c.id)).toBe(true);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });
  it("throws for unknown ids", () => {
    expect(isCalculatorId("nope")).toBe(false);
    expect(() => getCalculator("nope")).toThrow(RangeError);
  });
  it("defineCalculator shares TDEE and target logic", () => {
    const flat = defineCalculator({ id: "flat", name: "Flat", description: "Test", bmr: () => 2000 });
    expect(flat.calculateTDEE({ ...male30, activityLevel: "sedentary" })).toBeCloseTo(2400, 9);
    const result = flat.calculateTarget({ ...male30, activityLevel: "sedentary" }, { type: "maintain" });
    expect(result).toMatchObject({ calculatorId: "flat", bmr: 2000, target: 2400 });
    expect(Object.isFrozen(flat)).toBe(true);
  });
});

describe("ACTIVITY_LEVELS", () => {
  it("has the five PAL multipliers in ascending order", () => {
    expect(ACTIVITY_LEVELS.map((l) => [l.id, l.multiplier])).toEqual([
      ["sedentary", 1.2],
      ["light", 1.375],
      ["moderate", 1.55],
      ["active", 1.725],
      ["very_active", 1.9],
    ]);
    expect(ACTIVITY_MULTIPLIERS.moderate).toBe(1.55);
  });
  it("has German labels and descriptions", () => {
    for (const level of ACTIVITY_LEVELS) {
      expect(level.label).toMatch(/aktiv/i);
      expect(level.description.length).toBeGreaterThan(20);
    }
  });
});
