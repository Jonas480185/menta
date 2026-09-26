import { describe, expect, it } from "vitest";
import { kcalFromMacros, macroEnergySplit, sumTotals } from "./totals";
import { ZERO_TOTALS, type NutrientTotals } from "./types";

const t = (partial: Partial<NutrientTotals>): NutrientTotals => ({ ...ZERO_TOTALS, ...partial });

describe("sumTotals", () => {
  it("returns zero macros and null optionals for an empty list", () => {
    expect(sumTotals([])).toEqual(ZERO_TOTALS);
  });

  it("returns a new object (never the shared ZERO_TOTALS)", () => {
    const sum = sumTotals([]);
    expect(sum).not.toBe(ZERO_TOTALS);
    sum.kcal = 5;
    expect(ZERO_TOTALS.kcal).toBe(0);
  });

  it("sums the required nutrients", () => {
    expect(
      sumTotals([
        t({ kcal: 100, proteinG: 5, carbsG: 10, fatG: 4 }),
        t({ kcal: 250.5, proteinG: 20, carbsG: 0, fatG: 15.5 }),
      ]),
    ).toMatchObject({ kcal: 350.5, proteinG: 25, carbsG: 10, fatG: 19.5 });
  });

  it("optional nutrient is null only if all values are null", () => {
    expect(sumTotals([t({}), t({})]).fiberG).toBeNull();
  });

  it("optional nutrient sums the known values and ignores unknown ones", () => {
    const sum = sumTotals([t({ fiberG: 3 }), t({ fiberG: null }), t({ fiberG: 4.5 })]);
    expect(sum.fiberG).toBe(7.5);
  });

  it("a known 0 makes the sum known (0, not null)", () => {
    expect(sumTotals([t({ sugarG: 0 }), t({ sugarG: null })]).sugarG).toBe(0);
  });

  it("handles every optional key independently", () => {
    const sum = sumTotals([
      t({ fiberG: 1, sugarG: null, saturatedFatG: 2, sodiumMg: null }),
      t({ fiberG: null, sugarG: 3, saturatedFatG: 2, sodiumMg: null }),
    ]);
    expect(sum).toMatchObject({ fiberG: 1, sugarG: 3, saturatedFatG: 4, sodiumMg: null });
  });

  it("is order-independent and associative (meal sums → day sum)", () => {
    const a = t({ kcal: 100, fiberG: 1 });
    const b = t({ kcal: 200, fiberG: null });
    const c = t({ kcal: 300, fiberG: 2 });
    expect(sumTotals([sumTotals([a, b]), sumTotals([c])])).toEqual(sumTotals([c, b, a]));
    expect(sumTotals([sumTotals([b]), sumTotals([])]).fiberG).toBeNull();
  });
});

describe("kcalFromMacros", () => {
  it("uses 4/4/9", () => {
    expect(kcalFromMacros({ proteinG: 150, carbsG: 200, fatG: 67 })).toBe(600 + 800 + 603);
  });

  it("counts alcohol with 7 kcal/g when given", () => {
    expect(kcalFromMacros({ proteinG: 0, carbsG: 0, fatG: 0, alcoholG: 10 })).toBe(70);
    expect(kcalFromMacros({ proteinG: 1, carbsG: 1, fatG: 1, alcoholG: null })).toBe(17);
  });

  it("is 0 for no macros", () => {
    expect(kcalFromMacros({ proteinG: 0, carbsG: 0, fatG: 0 })).toBe(0);
  });
});

describe("macroEnergySplit", () => {
  it("splits by macro energy and sums to 1", () => {
    const s = macroEnergySplit({ proteinG: 150, carbsG: 200, fatG: 67 });
    expect(s.protein).toBeCloseTo(600 / 2003, 12);
    expect(s.carbs).toBeCloseTo(800 / 2003, 12);
    expect(s.fat).toBeCloseTo(603 / 2003, 12);
    expect(s.protein + s.carbs + s.fat).toBeCloseTo(1, 12);
  });

  it("weights fat with 9 kcal/g", () => {
    expect(macroEnergySplit({ proteinG: 0, carbsG: 9, fatG: 4 })).toEqual({ protein: 0, carbs: 0.5, fat: 0.5 });
  });

  it("single-macro food → 100 %", () => {
    expect(macroEnergySplit({ proteinG: 0, carbsG: 0, fatG: 100 })).toEqual({ protein: 0, carbs: 0, fat: 1 });
  });

  it("returns zeros when there are no macros (no NaN)", () => {
    expect(macroEnergySplit({ proteinG: 0, carbsG: 0, fatG: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});
