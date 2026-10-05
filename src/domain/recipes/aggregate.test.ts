import { describe, expect, it } from "vitest";
import { NBSP } from "@/lib/format";
import {
  aggregateRecipe,
  formatPortions,
  isRecipeInputError,
  macroEnergySplit,
  minPlausibleWeightG,
  RecipeInputError,
  recipePortionLabel,
} from "./index";

const chicken = { kcal: 110, proteinG: 23, carbsG: 0, fatG: 1.5 };
const rice = { kcal: 350, proteinG: 7, carbsG: 76, fatG: 0.6 };
const coconutMilk = { kcal: 110, proteinG: 4, carbsG: 0, fatG: 11.45 };

const curry = [
  { per100: chicken, grams: 600 },
  { per100: rice, grams: 200 },
  { per100: coconutMilk, grams: 400 },
];

describe("aggregateRecipe", () => {
  it("Chicken Curry: 1800 kcal, 4 Portionen → 450 kcal / 42 g P / 38 g C / 14 g F per Portion", () => {
    const r = aggregateRecipe({ ingredients: curry, servings: 4 });
    expect(r.totals.kcal).toBeCloseTo(1800, 6);
    expect(r.perServing.kcal).toBeCloseTo(450, 6);
    expect(r.perServing.proteinG).toBeCloseTo(42, 6);
    expect(r.perServing.carbsG).toBeCloseTo(38, 6);
    expect(r.perServing.fatG).toBeCloseTo(14, 6);
    expect(r.rawWeightG).toBe(1200);
    expect(r.totalWeightG).toBe(1200);
    expect(r.servingGrams).toBe(300);
    expect(r.hasCookedWeight).toBe(false);
    expect(r.per100g.kcal).toBeCloseTo(150, 6);
  });

  it("cooked weight changes per-100 g and portion grams, not totals or per-portion values", () => {
    const raw = aggregateRecipe({ ingredients: curry, servings: 4 });
    const cooked = aggregateRecipe({ ingredients: curry, servings: 4, totalWeightG: 1000 });
    expect(cooked.totals).toEqual(raw.totals);
    expect(cooked.perServing).toEqual(raw.perServing);
    expect(cooked.totalWeightG).toBe(1000);
    expect(cooked.rawWeightG).toBe(1200);
    expect(cooked.servingGrams).toBe(250);
    expect(cooked.hasCookedWeight).toBe(true);
    expect(cooked.per100g.kcal).toBeCloseTo(180, 6);
    expect(cooked.per100g.proteinG).toBeCloseTo(16.8, 6);
  });

  it("optional nutrients: sum of known values, null only when all are unknown", () => {
    const r = aggregateRecipe({
      servings: 2,
      ingredients: [
        { per100: { ...chicken, fiberG: null, sugarG: 1 }, grams: 100 },
        { per100: { ...rice, fiberG: 2, sugarG: 0 }, grams: 100 },
      ],
    });
    expect(r.totals.fiberG).toBeCloseTo(2);
    expect(r.totals.sugarG).toBeCloseTo(1);
    expect(r.totals.sodiumMg).toBeNull();
    expect(r.perServing.fiberG).toBeCloseTo(1);
    expect(r.per100g.sodiumMg).toBeNull();
    expect(r.incomplete).toEqual(["fiberG"]);
  });

  it("zero values count as known", () => {
    const r = aggregateRecipe({
      servings: 1,
      ingredients: [{ per100: { ...chicken, saltG: 0 }, grams: 50 }],
    });
    expect(r.totals.saltG).toBe(0);
    expect(r.incomplete).toEqual([]);
  });

  it("uses density for ml ingredients' weight but ml amounts for nutrients", () => {
    const milk = { kcal: 64, proteinG: 3.4, carbsG: 4.8, fatG: 3.5 };
    const r = aggregateRecipe({
      servings: 1,
      ingredients: [{ per100: milk, grams: 200, basis: "ml", densityGPerMl: 1.03 }],
    });
    expect(r.totals.kcal).toBeCloseTo(128);
    expect(r.rawWeightG).toBeCloseTo(206);
    const noDensity = aggregateRecipe({
      servings: 1,
      ingredients: [{ per100: milk, grams: 200, basis: "ml" }],
    });
    expect(noDensity.rawWeightG).toBe(200);
  });

  it("returns zeros for an empty ingredient list", () => {
    const r = aggregateRecipe({ ingredients: [], servings: 4 });
    expect(r.totals.kcal).toBe(0);
    expect(r.per100g.kcal).toBe(0);
    expect(r.servingGrams).toBe(0);
    expect(r.minTotalWeightG).toBe(0);
  });

  it("supports fractional servings", () => {
    const r = aggregateRecipe({ ingredients: curry, servings: 2.5 });
    expect(r.perServing.kcal).toBeCloseTo(720);
    expect(r.servingGrams).toBeCloseTo(480);
  });

  it.each([
    [{ servings: 0 }, "servings"],
    [{ servings: -1 }, "servings"],
    [{ servings: Number.NaN }, "servings"],
    [{ servings: 2, totalWeightG: 0 }, "totalWeightG"],
    [{ servings: 2, totalWeightG: Number.POSITIVE_INFINITY }, "totalWeightG"],
  ])("rejects invalid input %o", (overrides, field) => {
    try {
      aggregateRecipe({ ingredients: curry, ...overrides });
      expect.unreachable();
    } catch (err) {
      expect(isRecipeInputError(err)).toBe(true);
      expect((err as RecipeInputError).field).toBe(field);
    }
  });

  it("rejects invalid ingredients", () => {
    expect(() => aggregateRecipe({ servings: 1, ingredients: [{ per100: chicken, grams: 0 }] })).toThrow(
      RecipeInputError,
    );
    expect(() =>
      aggregateRecipe({ servings: 1, ingredients: [{ per100: { ...chicken, kcal: -1 }, grams: 10 }] }),
    ).toThrow(/Nährwerte/);
    expect(() =>
      aggregateRecipe({
        servings: 1,
        ingredients: [{ per100: { ...chicken, fiberG: Number.NaN }, grams: 10 }],
      }),
    ).toThrow(RecipeInputError);
  });

  it("reports the minimum plausible cooked weight", () => {
    const r = aggregateRecipe({ ingredients: curry, servings: 4 });
    // 1800 kcal → ≥ 180 g (1000 kcal/100 g); P+C+F = 376 g → ≥ 358 g (105 g/100 g)
    expect(r.minTotalWeightG).toBeCloseTo((376 * 100) / 105, 6);
    const oil = aggregateRecipe({
      servings: 1,
      ingredients: [{ per100: { kcal: 900, proteinG: 0, carbsG: 0, fatG: 100 }, grams: 50 }],
    });
    expect(oil.minTotalWeightG).toBeCloseTo(50, 6);
    expect(minPlausibleWeightG(oil.totals)).toBeCloseTo(50, 6);
  });
});

describe("macroEnergySplit", () => {
  it("splits energy 4/4/9", () => {
    const s = macroEnergySplit({ proteinG: 10, carbsG: 10, fatG: 0 });
    expect(s).toEqual({ protein: 0.5, carbs: 0.5, fat: 0 });
    const t = macroEnergySplit({ proteinG: 42, carbsG: 38, fatG: 14 });
    expect(t.protein + t.carbs + t.fat).toBeCloseTo(1);
  });
  it("returns zeros without macros", () => {
    expect(macroEnergySplit({ proteinG: 0, carbsG: 0, fatG: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});

describe("labels", () => {
  it("formats the portion label", () => {
    expect(recipePortionLabel(362.6)).toBe(`1 Portion (≈${NBSP}363${NBSP}g)`);
    expect(recipePortionLabel(7.25)).toBe(`1 Portion (≈${NBSP}7,3${NBSP}g)`);
  });
  it("formats portions", () => {
    expect(formatPortions(1)).toBe(`1${NBSP}Portion`);
    expect(formatPortions(4)).toBe(`4${NBSP}Portionen`);
    expect(formatPortions(2.5)).toBe(`2,5${NBSP}Portionen`);
  });
});
