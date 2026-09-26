import { describe, expect, it } from "vitest";
import {
  computeRemaining,
  dayNutrientStatus,
  kcalBudget,
  macroStatus,
  progressRatio,
  STATUS_THRESHOLDS,
  type TargetValues,
} from "./targets";
import { ZERO_TOTALS, type NutrientTotals } from "./types";

const targets: TargetValues = { calories: 2300, proteinG: 150, carbsG: 281, fatG: 64, fiberG: 30 };
const consumed = (partial: Partial<NutrientTotals>): NutrientTotals => ({ ...ZERO_TOTALS, ...partial });

describe("STATUS_THRESHOLDS", () => {
  it("matches the product spec (90 % / 100 % / 105 %)", () => {
    expect(STATUS_THRESHOLDS).toEqual({ near: 0.9, reached: 1, over: 1.05 });
  });
});

describe("progressRatio", () => {
  it.each([
    [0, 2000, 0],
    [1000, 2000, 0.5],
    [2000, 2000, 1],
    [2400, 2000, 1.2],
  ])("%s / %s → %s (unclamped)", (c, t, r) => {
    expect(progressRatio(c, t)).toBe(r);
  });

  it.each([0, -5, null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    "is null without a meaningful target (%s)",
    (t) => {
      expect(progressRatio(100, t)).toBeNull();
    },
  );

  it("treats negative/NaN consumption as 0", () => {
    expect(progressRatio(-10, 100)).toBe(0);
    expect(progressRatio(Number.NaN, 100)).toBe(0);
  });
});

describe("macroStatus", () => {
  it.each([
    [0, 2000, "none"],
    [1, 2000, "under"],
    [1799, 2000, "under"],
    [1800, 2000, "near"], // exactly 90 %
    [1999, 2000, "near"],
    [2000, 2000, "reached"], // exactly 100 %
    [2100, 2000, "reached"], // exactly 105 % still reached
    [2101, 2000, "over"], // > 105 %
    [4000, 2000, "over"],
  ] as const)("%s of %s → %s", (c, t, status) => {
    expect(macroStatus(c, t)).toBe(status);
  });

  it("IA example: fat 66 / 64 g is within tolerance", () => {
    expect(macroStatus(66, 64)).toBe("reached");
    expect(macroStatus(68, 64)).toBe("over");
  });

  it("protein over target is neutral (reached), not over", () => {
    expect(macroStatus(200, 150, { exceedIsNeutral: true })).toBe("reached");
    expect(macroStatus(140, 150, { exceedIsNeutral: true })).toBe("near");
    expect(macroStatus(0, 150, { exceedIsNeutral: true })).toBe("none");
  });

  it("zero target (e.g. zero-carb profile)", () => {
    expect(macroStatus(0, 0)).toBe("none");
    expect(macroStatus(5, 0)).toBe("over");
    expect(macroStatus(5, 0, { exceedIsNeutral: true })).toBe("reached");
  });

  it("negative / NaN consumption → none", () => {
    expect(macroStatus(-1, 100)).toBe("none");
    expect(macroStatus(Number.NaN, 100)).toBe("none");
  });
});

describe("kcalBudget", () => {
  it("adds counted activity kcal", () => {
    expect(kcalBudget(targets)).toBe(2300);
    expect(kcalBudget(targets, { activityKcal: 320 })).toBe(2620);
  });

  it("ignores negative / NaN activity", () => {
    expect(kcalBudget(targets, { activityKcal: -100 })).toBe(2300);
    expect(kcalBudget(targets, { activityKcal: Number.NaN })).toBe(2300);
  });
});

describe("computeRemaining", () => {
  it("IA example: 1.620 of 2.300 kcal → 680 left; fat 2 g over", () => {
    const r = computeRemaining(targets, consumed({ kcal: 1620, proteinG: 96, carbsG: 160, fatG: 66 }));
    expect(r).toEqual({ kcal: 680, proteinG: 54, carbsG: 121, fatG: -2, fiberG: 30 });
  });

  it("adds activity calories to the kcal budget only", () => {
    const r = computeRemaining(targets, consumed({ kcal: 1620, proteinG: 96 }), { activityKcal: 320 });
    expect(r.kcal).toBe(1000);
    expect(r.proteinG).toBe(54);
  });

  it("goes negative when over target", () => {
    expect(computeRemaining(targets, consumed({ kcal: 2610 })).kcal).toBe(-310);
  });

  it("fiber: null without target, unknown consumption counts as 0", () => {
    expect(computeRemaining({ ...targets, fiberG: null }, consumed({ fiberG: 5 })).fiberG).toBeNull();
    expect(computeRemaining(targets, consumed({ fiberG: null })).fiberG).toBe(30);
    expect(computeRemaining(targets, consumed({ fiberG: 12.5 })).fiberG).toBe(17.5);
  });
});

describe("dayNutrientStatus", () => {
  it("rates each nutrient; protein and fiber over target are neutral", () => {
    const s = dayNutrientStatus(
      targets,
      consumed({ kcal: 2500, proteinG: 200, carbsG: 250, fatG: 80, fiberG: 45 }),
    );
    expect(s).toEqual({ kcal: "over", protein: "reached", carbs: "near", fat: "over", fiber: "reached" });
  });

  it("measures kcal against target + activity", () => {
    const c = consumed({ kcal: 2500 });
    expect(dayNutrientStatus(targets, c).kcal).toBe("over");
    expect(dayNutrientStatus(targets, c, { activityKcal: 300 }).kcal).toBe("near");
  });

  it("empty day → none everywhere; fiber null without a fiber target", () => {
    expect(dayNutrientStatus({ ...targets, fiberG: null }, consumed({}))).toEqual({
      kcal: "none",
      protein: "none",
      carbs: "none",
      fat: "none",
      fiber: null,
    });
  });
});
