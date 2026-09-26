import { describe, expect, it } from "vitest";
import { isEnergyMismatch, qualityFor, validateNormalizedFood, validateNutrients } from "./validation";
import { kcalFromKj, kcalFromMacros, saltGFromSodiumMg, sodiumMgFromSaltG } from "./nutrients";

const oats = { kcal: 372, proteinG: 13.5, carbsG: 58.7, fatG: 7, fiberG: 10, sugarG: 0.7, saturatedFatG: 1.3, saltG: 0.03 };

describe("nutrient helpers", () => {
  it("converts salt, sodium and energy", () => {
    expect(saltGFromSodiumMg(400)).toBe(1);
    expect(sodiumMgFromSaltG(1)).toBe(400);
    expect(kcalFromKj(4184)).toBe(1000);
    expect(kcalFromMacros({ proteinG: 10, carbsG: 10, fatG: 10, alcoholG: 1 })).toBe(177);
  });
});

describe("validateNutrients – valid data", () => {
  it("accepts a clean label (oat flakes) as complete", () => {
    const r = validateNutrients(oats);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.quality).toBe("complete");
    expect(r.flags).toEqual(["sodium_derived"]);
    expect(r.nutrients.sodiumMg).toBe(12);
  });

  it("tolerates energy mismatches only for trusted data", () => {
    expect(qualityFor(false, ["energy_mismatch"], true)).toBe("verified");
    expect(qualityFor(false, ["energy_mismatch"], false)).toBe("suspect");
    expect(qualityFor(false, ["sugar_exceeds_carbs"], true)).toBe("suspect");
  });

  it("marks trusted clean data as verified", () => {
    expect(validateNutrients(oats, { trusted: true }).quality).toBe("verified");
  });

  it("accepts pure oil at 900 kcal (USDA: 902) and zero-calorie water", () => {
    expect(validateNutrients({ kcal: 900, proteinG: 0, carbsG: 0, fatG: 100 }).valid).toBe(true);
    expect(validateNutrients({ kcal: 902, proteinG: 0, carbsG: 0, fatG: 100 }).valid).toBe(true);
    expect(validateNutrients({ kcal: 910, proteinG: 0, carbsG: 0, fatG: 100 }).valid).toBe(false);
    expect(validateNutrients({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }).quality).toBe("complete");
  });

  it("accepts USDA-style carbs that include fibre", () => {
    // Almonds (SR Legacy): 579 kcal, P 21.15, C 21.55 (incl. 12.5 fibre), F 49.93
    expect(validateNutrients({ kcal: 579, proteinG: 21.15, carbsG: 21.55, fatG: 49.93, fiberG: 12.5 }).flags).not.toContain(
      "energy_mismatch",
    );
  });

  it("allows > 100 g macros per 100 ml for dense liquids", () => {
    const syrup = { kcal: 330, proteinG: 0, carbsG: 110, fatG: 0 };
    expect(validateNutrients(syrup).valid).toBe(false);
    expect(validateNutrients(syrup, { basis: "ml" }).valid).toBe(true);
  });
});

describe("validateNutrients – hard errors", () => {
  it.each([
    ["negative value", { ...oats, proteinG: -1 }, "negative_value"],
    ["NaN", { ...oats, fatG: Number.NaN }, "not_a_number"],
    ["kcal > 900", { kcal: 950, proteinG: 0, carbsG: 0, fatG: 100 }, "kcal_exceeds_max"],
    ["macro sum > 100 g", { kcal: 500, proteinG: 50, carbsG: 50, fatG: 10 }, "macro_sum_exceeds_100"],
    ["single value > 100 g", { ...oats, fiberG: 120 }, "value_out_of_range"],
    ["absurd sodium", { ...oats, saltG: null, sodiumMg: 50_000 }, "value_out_of_range"],
    ["no data at all", {}, "no_nutrition_data"],
  ])("%s", (_, input, code) => {
    const r = validateNutrients(input);
    expect(r.valid).toBe(false);
    expect(r.quality).toBe("suspect");
    expect(r.errors.map((e) => e.code)).toContain(code);
  });
});

describe("validateNutrients – soft flags", () => {
  it("flags energy mismatch (kJ typed into kcal)", () => {
    const r = validateNutrients({ kcal: 1566, proteinG: 13.5, carbsG: 58.7, fatG: 7 });
    // 1566 > 900 is also a hard error; use a smaller mismatch for the flag alone
    expect(r.valid).toBe(false);
    const soft = validateNutrients({ kcal: 150, proteinG: 13.5, carbsG: 58.7, fatG: 7 });
    expect(soft.valid).toBe(true);
    expect(soft.flags).toContain("energy_mismatch");
    expect(soft.quality).toBe("suspect");
  });

  it("tolerates label rounding within 20 kcal / 20 %", () => {
    expect(isEnergyMismatch(42, { proteinG: 0, carbsG: 10.6, fatG: 0 })).toBe(false);
    expect(isEnergyMismatch(20, { proteinG: 1, carbsG: 3, fatG: 0 })).toBe(false);
    expect(isEnergyMismatch(373, { proteinG: 8.3, carbsG: 60, fatG: 1.5, fiberG: 16 })).toBe(false);
    expect(isEnergyMismatch(480, { proteinG: 8.3, carbsG: 60, fatG: 1.5, fiberG: 16 })).toBe(true);
  });

  it("includes alcohol energy when known", () => {
    const beer = { kcal: 43, proteinG: 0.5, carbsG: 3.6, fatG: 0, micronutrients: { alcohol_g: 3.9 } };
    expect(validateNutrients(beer).flags).not.toContain("energy_mismatch");
  });

  it("flags sugar > carbs and saturated fat > fat", () => {
    const r = validateNutrients({ ...oats, sugarG: 70, saturatedFatG: 9 });
    expect(r.flags).toEqual(expect.arrayContaining(["sugar_exceeds_carbs", "saturated_fat_exceeds_fat"]));
    expect(r.quality).toBe("suspect");
  });

  it("does not flag sugar == carbs (e.g. table sugar)", () => {
    expect(validateNutrients({ kcal: 400, proteinG: 0, carbsG: 100, fatG: 0, sugarG: 100 }).flags).not.toContain(
      "sugar_exceeds_carbs",
    );
  });

  it("derives salt from sodium and vice versa", () => {
    const fromSodium = validateNutrients({ ...oats, saltG: null, sodiumMg: 400 });
    expect(fromSodium.nutrients.saltG).toBe(1);
    expect(fromSodium.flags).toContain("salt_derived");
    const fromSalt = validateNutrients({ ...oats, saltG: 1.3 });
    expect(fromSalt.nutrients.sodiumMg).toBe(520);
  });

  it("fixes salt/sodium contradictions by trusting salt (Toffifee fixture)", () => {
    const r = validateNutrients({ ...oats, saltG: 0.27, sodiumMg: 0.11 });
    expect(r.flags).toEqual(expect.arrayContaining(["salt_sodium_mismatch", "sodium_derived"]));
    expect(r.nutrients.sodiumMg).toBe(108);
    expect(r.quality).toBe("complete");
  });

  it("accepts consistent salt and sodium", () => {
    expect(validateNutrients({ ...oats, saltG: 1, sodiumMg: 400 }).flags).toEqual([]);
  });

  it("treats missing core macros as partial and fills 0", () => {
    const r = validateNutrients({ kcal: 250, proteinG: 5, carbsG: null, fatG: null });
    expect(r.valid).toBe(true);
    expect(r.quality).toBe("partial");
    expect(r.flags).toEqual(expect.arrayContaining(["missing_carbs", "missing_fat"]));
    expect(r.nutrients.carbsG).toBe(0);
  });

  it("respects provider missing_* flags on placeholder zeros", () => {
    const r = validateNutrients({ kcal: 250, proteinG: 0, carbsG: 30, fatG: 10 }, { existingFlags: ["missing_protein"] });
    expect(r.quality).toBe("partial");
  });

  it("derives kcal from complete macros", () => {
    const r = validateNutrients({ kcal: null, proteinG: 10, carbsG: 20, fatG: 5 });
    expect(r.nutrients.kcal).toBe(165);
    expect(r.flags).toContain("energy_derived");
    expect(r.quality).toBe("complete");
    const placeholder = validateNutrients({ kcal: 0, proteinG: 10, carbsG: 20, fatG: 5 }, { existingFlags: ["missing_kcal"] });
    expect(placeholder.nutrients.kcal).toBe(165);
    expect(placeholder.flags).not.toContain("missing_kcal");
  });

  it("marks kcal missing when macros are incomplete", () => {
    const r = validateNutrients({ kcal: null, proteinG: 10, carbsG: null, fatG: 5 });
    expect(r.flags).toContain("missing_kcal");
    expect(r.quality).toBe("partial");
  });

  it("drops invalid micronutrients", () => {
    const r = validateNutrients({ ...oats, micronutrients: { vitamin_c_mg: -3, iron_mg: 4 } });
    expect(r.nutrients.micronutrients).toEqual({ iron_mg: 4 });
    expect(r.flags).toContain("micronutrient_dropped");
  });

  it("passes through provider flags", () => {
    expect(validateNutrients(oats, { existingFlags: ["energy_from_kj"] }).flags).toContain("energy_from_kj");
  });
});

describe("qualityFor", () => {
  it("orders suspect > partial > verified/complete", () => {
    expect(qualityFor(true, [], true)).toBe("suspect");
    expect(qualityFor(false, ["energy_mismatch", "missing_fat"], false)).toBe("suspect");
    expect(qualityFor(false, ["missing_fat"], true)).toBe("partial");
    expect(qualityFor(false, ["sodium_derived"], true)).toBe("verified");
    expect(qualityFor(false, [], false)).toBe("complete");
  });
});

describe("validateNormalizedFood", () => {
  const food = {
    name: "Haferflocken",
    nutrientBasis: "g" as const,
    nutrients: oats,
    servings: [
      { label: "100 g", amount: 100, grams: 100 },
      { label: "1 EL", amount: 1, grams: 10 },
    ],
  };

  it("accepts a valid food", () => {
    expect(validateNormalizedFood(food).valid).toBe(true);
  });

  it("rejects missing names and servings with grams <= 0", () => {
    const r = validateNormalizedFood({ ...food, name: " ", servings: [{ label: "1 Stück", amount: 1, grams: 0 }] });
    expect(r.valid).toBe(false);
    expect(r.errors.map((e) => e.code)).toEqual(["missing_name", "invalid_serving"]);
    expect(r.quality).toBe("suspect");
  });
});
