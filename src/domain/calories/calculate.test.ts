import { describe, expect, it } from "vitest";
import { calculateCalories, estimateGoalDate } from "./calculate";
import { katchMcArdle, mifflinStJeor } from "./calculators";
import { GOAL_PACES, getGoalPaces, KCAL_PER_KG_BODY_WEIGHT } from "./constants";
import { resolveGoalPace, safetyFloorKcal } from "./target";
import type { BodyProfile, CalorieWarningCode, GoalSettings } from "./types";

const codes = (w: { code: CalorieWarningCode }[]) => w.map((x) => x.code);

/** Reference user "Jonas": BMR 1805, TDEE 1805 × 1.55 = 2797.75. */
const jonas: BodyProfile = { ageYears: 33, sex: "male", heightCm: 180, weightKg: 84, activityLevel: "moderate" };
/** Female 25 y 165 cm 60 kg sedentary: BMR 1345.25, TDEE 1614.3. */
const female25: BodyProfile = { ageYears: 25, sex: "female", heightCm: 165, weightKg: 60, activityLevel: "sedentary" };

describe("calculateCalories: reference user (docs/product/README.md)", () => {
  const calc = calculateCalories(jonas, { type: "lose", pace: "moderate", targetWeightKg: 78 });

  it("reproduces the documented chain 1.805 → 2.798 → −500 → 2.300", () => {
    expect(calc.calculatorId).toBe("mifflin_st_jeor");
    expect(calc.bmr).toBeCloseTo(1805, 9);
    expect(calc.activityMultiplier).toBe(1.55);
    expect(calc.tdee).toBeCloseTo(2797.75, 9);
    expect(calc.requestedAdjustment).toBe(-500);
    expect(calc.adjustment).toBe(-500);
    expect(calc.target).toBe(2300); // round10(2798 − 500 = 2298)
    expect(calc.capApplied).toBe(false);
    expect(calc.floorApplied).toBe(false);
    expect(calc.warnings).toEqual([]);
  });

  it("estimates weekly change with 7700 kcal/kg and time to goal", () => {
    expect(KCAL_PER_KG_BODY_WEIGHT).toBe(7700);
    expect(calc.weeklyChangeKg).toBeCloseTo((-500 * 7) / 7700, 9); // −0.4545…
    expect(calc.estimatedWeeksToGoal).toBe(14); // 6 kg / 0.4545 = 13.2 → 14
  });

  it("floor for Jonas = max(1500, BMR 1805) → 1810", () => {
    expect(calc.floorKcal).toBe(1810);
  });
});

describe("pace → adjustment", () => {
  it.each<[GoalSettings, number, number]>([
    [{ type: "lose", pace: "slow" }, -250, 2550], // 2798 − 250 = 2548
    [{ type: "lose", pace: "moderate" }, -500, 2300],
    [{ type: "maintain" }, 0, 2800], // round10(2798)
    [{ type: "maintain", pace: "fast" }, 0, 2800], // pace ignored
    [{ type: "gain", pace: "slow" }, 150, 2950], // 2948
    [{ type: "gain", pace: "moderate" }, 300, 3100], // 3098
    [{ type: "lose", pace: null }, -500, 2300], // default moderate
    [{ type: "gain" }, 300, 3100], // default moderate
  ])("%j → %d kcal → target %d", (goal, adjustment, target) => {
    const calc = calculateCalories(jonas, goal);
    expect(calc.adjustment).toBe(adjustment);
    expect(calc.target).toBe(target);
  });

  it("maintain has no weekly change even though the target is rounded", () => {
    const calc = calculateCalories(jonas, { type: "maintain", targetWeightKg: 70 });
    expect(calc.weeklyChangeKg).toBe(0);
    expect(calc.estimatedWeeksToGoal).toBeNull();
    expect(calc.warnings).toEqual([]);
  });

  it("gain + fast is treated as moderate with a hint", () => {
    const calc = calculateCalories(jonas, { type: "gain", pace: "fast" });
    expect(resolveGoalPace({ type: "gain", pace: "fast" })).toEqual({ pace: "moderate", adjusted: true });
    expect(calc.adjustment).toBe(300);
    expect(codes(calc.warningDetails)).toEqual(["pace_adjusted"]);
  });

  it("GOAL_PACES labels promise roughly what 7700 kcal/kg delivers", () => {
    for (const p of GOAL_PACES) {
      expect(Math.abs((p.adjustmentKcal * 7) / 7700 - p.approxWeeklyKg)).toBeLessThan(0.03);
      expect(p.label).toMatch(/kg\/Woche/);
    }
    expect(getGoalPaces("lose").map((p) => p.shortLabel)).toEqual(["Entspannt", "Moderat", "Ambitioniert"]);
    expect(getGoalPaces("gain").map((p) => p.pace)).toEqual(["slow", "moderate"]);
    expect(getGoalPaces("maintain")).toEqual([]);
  });
});

describe("25 % deficit cap", () => {
  it("caps Jonas' fast pace at floor10(2797.75 × 0.25) = 690", () => {
    const calc = calculateCalories(jonas, { type: "lose", pace: "fast", targetWeightKg: 78 });
    expect(calc.requestedAdjustment).toBe(-750);
    expect(calc.adjustment).toBe(-690);
    expect(calc.target).toBe(2110); // round10(2798 − 690 = 2108)
    expect(calc.capApplied).toBe(true);
    expect(calc.floorApplied).toBe(false);
    expect(codes(calc.warningDetails)).toEqual(["deficit_capped"]);
    expect(calc.warnings[0]).toContain("25 %");
    expect(calc.weeklyChangeKg).toBeCloseTo((-690 * 7) / 7700, 9);
    expect(calc.estimatedWeeksToGoal).toBe(10); // 6 / 0.627 = 9.57 → 10
  });

  it("does not cap when the deficit is exactly within 25 %", () => {
    // very_active Jonas: TDEE 3429.5 → max deficit 850 ≥ 750
    const calc = calculateCalories({ ...jonas, activityLevel: "very_active" }, { type: "lose", pace: "fast" });
    expect(calc.adjustment).toBe(-750);
    expect(calc.capApplied).toBe(false);
  });

  it("never caps a surplus", () => {
    const calc = calculateCalories(female25, { type: "gain", pace: "moderate" });
    expect(calc.adjustment).toBe(300);
    expect(calc.capApplied).toBe(false);
  });
});

describe("safety floor", () => {
  it("female 25 y sedentary, fast: cap −400, then floor = BMR 1345.25 → 1350", () => {
    const calc = calculateCalories(female25, { type: "lose", pace: "fast", targetWeightKg: 55 });
    expect(calc.tdee).toBeCloseTo(1614.3, 9);
    expect(calc.capApplied).toBe(true); // floor10(403.575) = 400
    expect(calc.floorKcal).toBe(1350);
    expect(calc.floorApplied).toBe(true); // round10(1614 − 400) = 1210 < 1350
    expect(calc.target).toBe(1350);
    expect(calc.adjustment).toBe(-264); // 1350 − 1614
    expect(calc.weeklyChangeKg).toBeCloseTo((-264 * 7) / 7700, 9); // −0.24
    expect(calc.estimatedWeeksToGoal).toBe(21); // 5 / 0.24 = 20.83 → 21
    expect(codes(calc.warningDetails)).toEqual(["deficit_capped", "floor_applied"]);
    expect(calc.warnings[1]).toContain("1.350");
  });

  it.each<[BodyProfile["sex"], number]>([
    ["female", 1200],
    ["male", 1500],
    ["unspecified", 1350],
  ])("absolute minimum for %s is %d kcal (when above the BMR)", (sex, min) => {
    expect(safetyFloorKcal({ sex }, 1000, 3000)).toBe(min);
  });

  it("uses the BMR when it is higher than the absolute minimum (rounded up to 10)", () => {
    expect(safetyFloorKcal({ sex: "female" }, 1345.25, 2000)).toBe(1350);
  });

  it("never exceeds the TDEE (rounded down to 10)", () => {
    expect(safetyFloorKcal({ sex: "male" }, 900, 1234)).toBe(1230);
  });

  it("very low maintenance: no deficit at all, with a gentle hint", () => {
    // female 80 y 150 cm 40 kg: BMR 400 + 937.5 − 400 − 161 = 776.5, TDEE 931.8
    const tiny: BodyProfile = { ageYears: 80, sex: "female", heightCm: 150, weightKg: 40, activityLevel: "sedentary" };
    const calc = calculateCalories(tiny, { type: "lose", pace: "slow", targetWeightKg: 38 });
    expect(calc.bmr).toBeCloseTo(776.5, 9);
    expect(calc.floorKcal).toBe(930);
    expect(calc.floorApplied).toBe(true);
    expect(calc.target).toBe(930);
    expect(calc.adjustment).toBe(0);
    expect(calc.weeklyChangeKg).toBe(0);
    expect(calc.estimatedWeeksToGoal).toBeNull();
    expect(codes(calc.warningDetails)).toEqual(["deficit_capped", "floor_applied", "low_maintenance"]);
  });

  it("does not apply to maintain or gain", () => {
    const tiny: BodyProfile = { ageYears: 80, sex: "female", heightCm: 150, weightKg: 40, activityLevel: "sedentary" };
    const calc = calculateCalories(tiny, { type: "maintain" });
    expect(calc.floorApplied).toBe(false);
    expect(calc.target).toBe(930);
    expect(codes(calc.warningDetails)).toEqual(["low_maintenance"]);
  });

  it("unspecified sex uses the averaged constant and the 1350 kcal minimum", () => {
    const p: BodyProfile = { ageYears: 30, sex: "unspecified", heightCm: 160, weightKg: 50, activityLevel: "sedentary" };
    // BMR 500 + 1000 − 150 − 78 = 1272 → TDEE 1526.4, cap floor10(381.6) = 380 → 1526 − 380 = 1146 → 1150
    const calc = calculateCalories(p, { type: "lose", pace: "moderate" });
    expect(calc.bmr).toBeCloseTo(1272, 9);
    expect(calc.floorKcal).toBe(1350);
    expect(calc.target).toBe(1350);
    expect(calc.adjustment).toBe(-176); // 1350 − 1526
  });
});

describe("time to goal & direction", () => {
  it("gain: 6 kg at +300 kcal/day → exactly 22 weeks (no float overshoot)", () => {
    const calc = calculateCalories(jonas, { type: "gain", pace: "moderate", targetWeightKg: 90 });
    expect(calc.weeklyChangeKg).toBeCloseTo(0.272727, 5);
    expect(calc.estimatedWeeksToGoal).toBe(22);
  });

  it("lose with a target above the current weight → hint, no estimate", () => {
    const calc = calculateCalories(jonas, { type: "lose", pace: "moderate", targetWeightKg: 90 });
    expect(calc.adjustment).toBe(-500); // the chosen goal still applies
    expect(calc.estimatedWeeksToGoal).toBeNull();
    expect(codes(calc.warningDetails)).toEqual(["target_above_current"]);
  });

  it("gain with a target below the current weight → hint, no estimate", () => {
    const calc = calculateCalories(jonas, { type: "gain", pace: "slow", targetWeightKg: 80 });
    expect(calc.estimatedWeeksToGoal).toBeNull();
    expect(codes(calc.warningDetails)).toEqual(["target_below_current"]);
  });

  it("target weight reached (within 0.1 kg) → 0 weeks + suggestion to maintain", () => {
    const calc = calculateCalories(jonas, { type: "lose", pace: "slow", targetWeightKg: 84.05 });
    expect(calc.estimatedWeeksToGoal).toBe(0);
    expect(codes(calc.warningDetails)).toEqual(["goal_reached"]);
  });

  it("no target weight → no estimate, no warning", () => {
    const calc = calculateCalories(jonas, { type: "lose", pace: "slow" });
    expect(calc.estimatedWeeksToGoal).toBeNull();
    expect(calc.warnings).toEqual([]);
  });

  it("rejects an out-of-range target weight", () => {
    expect(() => calculateCalories(jonas, { type: "lose", targetWeightKg: 10 })).toThrow(
      expect.objectContaining({ field: "targetWeightKg" }),
    );
  });

  it("estimateGoalDate adds whole weeks", () => {
    expect(estimateGoalDate("2026-09-26", 14)).toBe("2027-01-02");
    expect(estimateGoalDate("2026-09-26", 0)).toBe("2026-09-26");
    expect(estimateGoalDate("2026-09-26", null)).toBeNull();
  });
});

describe("calculator selection", () => {
  it("uses the requested calculator", () => {
    const calc = calculateCalories({ ...jonas, bodyFatPct: 20 }, { type: "maintain" }, { calculatorId: "katch_mcardle" });
    expect(calc.calculatorId).toBe("katch_mcardle");
    expect(calc.bmr).toBeCloseTo(katchMcArdle.calculateBMR({ ...jonas, bodyFatPct: 20 }), 9);
  });

  it("falls back to Mifflin-St Jeor when Katch-McArdle lacks body fat", () => {
    const calc = calculateCalories(jonas, { type: "maintain" }, { calculatorId: "katch_mcardle" });
    expect(calc.calculatorId).toBe("mifflin_st_jeor");
    expect(calc.bmr).toBeCloseTo(1805, 9);
    expect(codes(calc.warningDetails)).toEqual(["calculator_fallback"]);
    expect(calc.warnings[0]).toContain("Katch-McArdle");
  });

  it("silently uses the default for unknown/empty ids", () => {
    for (const calculatorId of ["unknown", null, undefined, ""]) {
      const calc = calculateCalories(jonas, { type: "maintain" }, { calculatorId });
      expect(calc.calculatorId).toBe("mifflin_st_jeor");
      expect(calc.warnings).toEqual([]);
    }
  });

  it("calculateTarget on the interface equals calculateCalories", () => {
    const goal: GoalSettings = { type: "lose", pace: "moderate", targetWeightKg: 78 };
    expect(mifflinStJeor.calculateTarget(jonas, goal)).toEqual(calculateCalories(jonas, goal));
  });
});

describe("age hints", () => {
  it.each([
    [16, true],
    [18, false],
    [100, false],
    [101, true],
  ])("age %d → hint %s", (ageYears, hint) => {
    const calc = calculateCalories({ ...jonas, ageYears }, { type: "maintain" });
    expect(codes(calc.warningDetails).includes("age_outside_range")).toBe(hint);
  });
});
