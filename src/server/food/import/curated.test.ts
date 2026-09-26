import { describe, expect, it } from "vitest";
import { buildCuratedFoods, loadCuratedFoods, resolveCuratedFood, servingAmountFromLabel, type CuratedFood } from "./curated";
import type { UsdaFoodRecord } from "@/server/food/normalize/usda";
import { USDA_NUTRIENT } from "@/server/food/normalize/usda";

const milkRec: UsdaFoodRecord = {
  fdcId: 171265,
  dataType: "sr_legacy_food",
  description: "Milk, whole, 3.25% milkfat, with added vitamin D",
  category: "Dairy and Egg Products",
  nutrients: new Map([
    [USDA_NUTRIENT.energyKcal, 61],
    [USDA_NUTRIENT.protein, 3.15],
    [USDA_NUTRIENT.carbs, 4.8],
    [USDA_NUTRIENT.fat, 3.25],
    [USDA_NUTRIENT.calcium, 113],
  ]),
  portions: [],
};

const milk: CuratedFood = {
  id: "vollmilch",
  nameDe: "Vollmilch 3,5 %",
  category: "Milchprodukte",
  fdcId: 171265,
  basis: "ml",
  densityGPerMl: 1.03,
  servings: [
    { label: "1 Glas", unit: "glass", grams: 200 },
    { label: "½ Tasse", unit: "cup", grams: 75 },
  ],
};

describe("curated foods", () => {
  it("committed list is valid, unique and large enough", async () => {
    const foods = await loadCuratedFoods();
    expect(foods.length).toBeGreaterThanOrEqual(400);
    expect(new Set(foods.map((f) => f.id)).size).toBe(foods.length);
    const categories = new Set(foods.map((f) => f.category));
    for (const c of ["Obst", "Gemüse", "Milchprodukte", "Käse", "Fleisch", "Getränke", "Brot & Backwaren"]) {
      expect(categories.has(c)).toBe(true);
    }
  });

  it("parses serving amounts from labels", () => {
    expect(servingAmountFromLabel("½ Stück")).toBe(0.5);
    expect(servingAmountFromLabel("2 Scheiben")).toBe(2);
    expect(servingAmountFromLabel("1,5 EL")).toBe(1.5);
    expect(servingAmountFromLabel("Handvoll")).toBe(1);
  });

  it("resolves nutrients from USDA, converts to per 100 ml and adds the base serving", () => {
    const r = resolveCuratedFood(milk, milkRec);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f = r.food;
    expect(f).toMatchObject({ source: "curated", sourceId: "vollmilch", name: "Vollmilch 3,5 %", language: "de", nutrientBasis: "ml" });
    expect(f.nutrients.kcal).toBeCloseTo(62.83, 1);
    expect(f.nutrients.calciumMg).toBeCloseTo(116.39, 1);
    expect(f.servings.map((s) => [s.label, s.amount, s.grams, s.isDefault])).toEqual([
      ["1 Glas", 1, 200, true],
      ["½ Tasse", 0.5, 75, false],
      ["100 ml", 100, 100, false],
    ]);
  });

  it("reports unknown fdcIds", () => {
    const r = buildCuratedFoods([milk, { ...milk, id: "x", fdcId: 1 }], new Map([[171265, milkRec]]));
    expect(r.foods).toHaveLength(1);
    expect(r.missing).toEqual([{ id: "x", fdcId: 1, reason: "unknown_fdc_id" }]);
  });
});
