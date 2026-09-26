import { describe, expect, it } from "vitest";
import { computeEntryNutrients, SALT_PER_SODIUM, scaleNutrients, sodiumMgFromSaltG } from "./scale";
import type { NutrientProfile } from "./types";

/** Haferflocken, per 100 g. */
const oats: NutrientProfile = {
  kcal: 372,
  proteinG: 13.5,
  carbsG: 58.7,
  fatG: 7,
  fiberG: 10,
  sugarG: 0.7,
  saturatedFatG: 1.2,
  saltG: 0.02,
  sodiumMg: 8,
};

/** Minimal profile: only the mandatory values are known. */
const bare: NutrientProfile = { kcal: 250, proteinG: 10, carbsG: 30, fatG: 10 };

describe("scaleNutrients", () => {
  it("returns the per-100 values for 100 units", () => {
    expect(scaleNutrients(oats, 100)).toEqual({
      kcal: 372,
      proteinG: 13.5,
      carbsG: 58.7,
      fatG: 7,
      fiberG: 10,
      sugarG: 0.7,
      saturatedFatG: 1.2,
      sodiumMg: 8,
    });
  });

  it("scales linearly", () => {
    const t = scaleNutrients(oats, 40);
    expect(t.kcal).toBeCloseTo(148.8, 10);
    expect(t.proteinG).toBeCloseTo(5.4, 10);
    expect(t.carbsG).toBeCloseTo(23.48, 10);
    expect(t.fatG).toBeCloseTo(2.8, 10);
    expect(t.fiberG).toBeCloseTo(4, 10);
    expect(t.sugarG).toBeCloseTo(0.28, 10);
    expect(t.saturatedFatG).toBeCloseTo(0.48, 10);
    expect(t.sodiumMg).toBeCloseTo(3.2, 10);
  });

  it("is exact for whole-number inputs (multiply before divide)", () => {
    expect(scaleNutrients({ kcal: 372, proteinG: 13, carbsG: 59, fatG: 7 }, 250).kcal).toBe(930);
  });

  it("returns zeros for amount 0 but keeps unknown nutrients null", () => {
    expect(scaleNutrients(bare, 0)).toEqual({
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
      sodiumMg: null,
    });
  });

  it("keeps unknown optional nutrients null (never 0)", () => {
    const t = scaleNutrients(bare, 150);
    expect(t).toMatchObject({ kcal: 375, proteinG: 15, carbsG: 45, fatG: 15 });
    expect(t.fiberG).toBeNull();
    expect(t.sugarG).toBeNull();
    expect(t.saturatedFatG).toBeNull();
    expect(t.sodiumMg).toBeNull();
  });

  it("keeps a known 0 as 0 (not null)", () => {
    const t = scaleNutrients({ ...bare, fiberG: 0, sugarG: 0 }, 80);
    expect(t.fiberG).toBe(0);
    expect(t.sugarG).toBe(0);
  });

  it("treats explicit null and undefined the same", () => {
    expect(scaleNutrients({ ...bare, fiberG: null }, 50)).toEqual(scaleNutrients(bare, 50));
  });

  it("derives sodium from salt when only salt is known (EU labels)", () => {
    const t = scaleNutrients({ ...bare, saltG: 1.25 }, 100);
    expect(t.sodiumMg).toBeCloseTo(500, 10);
    expect(scaleNutrients({ ...bare, saltG: 1.25 }, 50).sodiumMg).toBeCloseTo(250, 10);
  });

  it("prefers the explicit sodium value over the salt value", () => {
    expect(scaleNutrients({ ...bare, saltG: 5, sodiumMg: 100 }, 100).sodiumMg).toBe(100);
  });

  it("ignores micronutrients and other per-100 extras", () => {
    const t = scaleNutrients({ ...bare, potassiumMg: 300, micronutrients: { vitaminC: 5 } }, 100);
    expect(Object.keys(t).sort()).toEqual(
      ["carbsG", "fatG", "fiberG", "kcal", "proteinG", "saturatedFatG", "sodiumMg", "sugarG"].sort(),
    );
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid amount %s", (amount) => {
    expect(() => scaleNutrients(bare, amount)).toThrow(RangeError);
  });

  it("works for ml-based foods the same way (per 100 ml)", () => {
    const milk: NutrientProfile = { kcal: 64, proteinG: 3.4, carbsG: 4.8, fatG: 3.5 };
    expect(scaleNutrients(milk, 250).kcal).toBe(160);
  });
});

describe("salt ↔ sodium", () => {
  it("uses the EU factor 2.5", () => {
    expect(SALT_PER_SODIUM).toBe(2.5);
    expect(sodiumMgFromSaltG(1)).toBe(400);
    expect(sodiumMgFromSaltG(0)).toBe(0);
  });
});

describe("computeEntryNutrients", () => {
  it("computes grams = servingGrams × quantity and scales per 100", () => {
    const { grams, totals } = computeEntryNutrients({ per100: oats, servingGrams: 40, quantity: 1.5 });
    expect(grams).toBe(60);
    expect(totals.kcal).toBeCloseTo(223.2, 10);
    expect(totals.proteinG).toBeCloseTo(8.1, 10);
    expect(totals.fiberG).toBeCloseTo(6, 10);
  });

  it("the 100 g serving with quantity 1 equals the per-100 profile", () => {
    const { grams, totals } = computeEntryNutrients({ per100: oats, servingGrams: 100, quantity: 1 });
    expect(grams).toBe(100);
    expect(totals.kcal).toBe(372);
  });

  it("gram-based logging: servingGrams 1 × quantity 125", () => {
    const { grams, totals } = computeEntryNutrients({ per100: bare, servingGrams: 1, quantity: 125 });
    expect(grams).toBe(125);
    expect(totals.kcal).toBe(312.5);
  });

  it("allows a 0 g serving (e.g. a quick-add with no weight) and yields zero nutrients", () => {
    const { grams, totals } = computeEntryNutrients({ per100: oats, servingGrams: 0, quantity: 2 });
    expect(grams).toBe(0);
    expect(totals.kcal).toBe(0);
    expect(totals.fiberG).toBe(0);
  });

  it("keeps optional nulls in the snapshot", () => {
    const { totals } = computeEntryNutrients({ per100: bare, servingGrams: 30, quantity: 2 });
    expect(totals.fiberG).toBeNull();
    expect(totals.sodiumMg).toBeNull();
  });

  it("matches the per-entry values summing to the combined amount", () => {
    const a = computeEntryNutrients({ per100: oats, servingGrams: 30, quantity: 1 });
    const b = computeEntryNutrients({ per100: oats, servingGrams: 30, quantity: 2 });
    expect(a.totals.kcal + b.totals.kcal).toBeCloseTo(
      computeEntryNutrients({ per100: oats, servingGrams: 30, quantity: 3 }).totals.kcal,
      10,
    );
  });

  it.each([
    { servingGrams: 30, quantity: 0 },
    { servingGrams: 30, quantity: -1 },
    { servingGrams: -30, quantity: 1 },
    { servingGrams: Number.NaN, quantity: 1 },
    { servingGrams: 30, quantity: Number.POSITIVE_INFINITY },
  ])("rejects invalid input %o", (input) => {
    expect(() => computeEntryNutrients({ per100: oats, ...input })).toThrow(RangeError);
  });
});
