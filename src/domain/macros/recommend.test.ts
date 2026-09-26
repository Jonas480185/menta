import { describe, expect, it } from "vitest";
import { MACRO_KCAL_TOLERANCE } from "./math";
import { recommendMacros, referenceWeight } from "./recommend";
import { computeMacroTargets } from "./targets";
import { MacroInputError, type ActivityLevel, type GoalType } from "./types";

describe("referenceWeight", () => {
  it("uses the actual weight up to BMI 25", () => {
    expect(referenceWeight({ weightKg: 70, heightCm: 180 })).toBe(70);
  });

  it("counts only 25 % of the excess above BMI 25", () => {
    // BMI-25 weight at 180 cm = 81 kg; 121 kg → 81 + 0.25 · 40 = 91
    expect(referenceWeight({ weightKg: 121, heightCm: 180 })).toBeCloseTo(91, 6);
  });

  it("anchors on the target weight when no height is known", () => {
    expect(referenceWeight({ weightKg: 120, targetWeightKg: 80 })).toBeCloseTo(90, 6);
    expect(referenceWeight({ weightKg: 70, targetWeightKg: 80 })).toBe(70);
  });

  it("uses the actual weight without height and target", () => {
    expect(referenceWeight({ weightKg: 130 })).toBe(130);
  });
});

describe("recommendMacros", () => {
  it("reproduces the onboarding example (75 kg, lose, 2300 kcal → 150/281/64)", () => {
    const r = recommendMacros({ kcal: 2300, weightKg: 75, goal: "lose", activityLevel: "moderate" });
    expect(r.macros).toEqual({ proteinG: 150, carbsG: 281, fatG: 64 });
    expect(r.macroKcal).toBe(2300);
    expect(r.proteinGPerKg).toBe(2);
    expect(r.rationale.length).toBeGreaterThanOrEqual(3);
  });

  it("uses goal-specific protein factors", () => {
    const base = { kcal: 2500, weightKg: 80, activityLevel: "moderate" as const };
    expect(recommendMacros({ ...base, goal: "lose" }).macros.proteinG).toBe(160);
    expect(recommendMacros({ ...base, goal: "maintain" }).macros.proteinG).toBe(128);
    expect(recommendMacros({ ...base, goal: "gain" }).macros.proteinG).toBe(144);
  });

  it("adjusts protein by activity within 1.2–2.2 g/kg", () => {
    const base = { kcal: 2500, weightKg: 80 };
    expect(recommendMacros({ ...base, goal: "lose", activityLevel: "very_active" }).proteinGPerKg).toBe(2.2);
    expect(
      recommendMacros({ ...base, goal: "maintain", activityLevel: "sedentary" }).proteinGPerKg,
    ).toBeCloseTo(1.4, 9);
  });

  it("uses fat share by goal and a 0.6 g/kg floor", () => {
    const maintain = recommendMacros({ kcal: 2400, weightKg: 70, goal: "maintain", activityLevel: "light" });
    expect(maintain.macros.fatG).toBe(80); // 30 % of 2400 / 9
    // very low kcal, heavy person → floor 0.6 g/kg wins over 25 %
    const low = recommendMacros({ kcal: 1400, weightKg: 90, goal: "lose", activityLevel: "light" });
    expect(low.macros.fatG).toBe(54); // 0.6 · 90 = 54 > 1400 · 0.25 / 9 = 38.9
    // … but never above 40 % of the calories
    const capped = recommendMacros({ kcal: 1400, weightKg: 110, goal: "lose", activityLevel: "light" });
    expect(capped.macros.fatG).toBe(62); // 1400 · 0.4 / 9 = 62.2
  });

  it("uses the reference weight for high body weights", () => {
    const r = recommendMacros({
      kcal: 2200,
      weightKg: 140,
      heightCm: 175,
      goal: "lose",
      activityLevel: "moderate",
    });
    // BMI-25 weight = 76.6 kg → reference 76.6 + 0.25 · 63.4 ≈ 92.4 → ~185 g, not 280 g
    expect(r.referenceWeightKg).toBeCloseTo(92.3, 0);
    expect(r.macros.proteinG).toBe(185);
    expect(r.rationale[0]).toContain("Bezugsgewicht");
  });

  it("caps protein at 40 % of the calories", () => {
    const r = recommendMacros({ kcal: 1200, weightKg: 100, goal: "lose", activityLevel: "very_active" });
    expect(r.macros.proteinG * 4).toBeLessThanOrEqual(1200 * 0.4 + 2);
  });

  it("stays consistent (±5 kcal, integer, carbs ≥ 0) across the whole input space", () => {
    const goals: GoalType[] = ["lose", "maintain", "gain"];
    const levels: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
    for (const goal of goals)
      for (const activityLevel of levels)
        for (let kcal = 1000; kcal <= 4500; kcal += 175)
          for (const weightKg of [45, 60, 75, 90, 120, 180])
            for (const heightCm of [null, 160, 190]) {
              const r = recommendMacros({ kcal, weightKg, heightCm, goal, activityLevel });
              expect(Math.abs(r.diffKcal)).toBeLessThanOrEqual(MACRO_KCAL_TOLERANCE);
              expect(r.macros.carbsG).toBeGreaterThanOrEqual(0);
              expect(Number.isInteger(r.macros.proteinG + r.macros.carbsG + r.macros.fatG)).toBe(true);
            }
  });

  it("rejects implausible weights", () => {
    expect(() => recommendMacros({ kcal: 2000, weightKg: 10, goal: "lose", activityLevel: "light" })).toThrow(
      MacroInputError,
    );
  });
});

describe("computeMacroTargets", () => {
  it("dispatches all three modes", () => {
    expect(
      computeMacroTargets({ mode: "percent", kcal: 2000, percents: { protein: 30, carbs: 40, fat: 30 } })
        .macros,
    ).toEqual({
      proteinG: 150,
      carbsG: 199,
      fatG: 67,
    });
    const g = computeMacroTargets({ mode: "grams", kcal: 2400, proteinG: 180, fatG: 70 });
    expect(g.mode === "grams" && g.carbsRemainderG).toBeCloseTo(262.5, 9);
    const a = computeMacroTargets({
      mode: "auto",
      kcal: 2300,
      weightKg: 75,
      goal: "lose",
      activityLevel: "moderate",
    });
    expect(a.mode).toBe("auto");
    expect(a.macros).toEqual({ proteinG: 150, carbsG: 281, fatG: 64 });
  });
});
