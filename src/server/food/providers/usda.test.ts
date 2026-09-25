import { afterEach, describe, expect, it, vi } from "vitest";
import { mapUsdaRecord, usdaPortionsToServings, usdaRecordFromApi, type UsdaFoodRecord } from "@/server/food/normalize/usda";
import { validateNormalizedFood } from "@/domain/food/validation";
import { UsdaProvider } from "./usda";
import { TokenBucket } from "./http";
import { fixtureFetch, loadFixture } from "./__fixtures__/load";

const unlimited = () => new TokenBucket({ capacity: 1000, requests: 1000, perMs: 1 });

function mapFixture(name: string) {
  const rec = usdaRecordFromApi(loadFixture(name));
  if (!rec) throw new Error("record");
  const r = mapUsdaRecord(rec);
  if (!r.ok) throw new Error(r.reason);
  return r.food;
}

describe("USDA normalization", () => {
  it("maps SR Legacy details incl. micronutrients and German portions (Bananas, raw)", () => {
    const food = mapFixture("usda-food-173944-sr-legacy.json");
    expect(food).toMatchObject({
      source: "usda",
      sourceId: "173944",
      name: "Bananas, raw",
      language: "en",
      category: "Fruits and Fruit Juices",
      nutrientBasis: "g",
      barcode: null,
      brandName: null,
    });
    expect(food.nutrients).toMatchObject({ kcal: 89, proteinG: 1.09, fatG: 0.33, carbsG: 22.84, fiberG: 2.6, sugarG: 12.23 });
    expect(food.nutrients.potassiumMg).toBe(358);
    expect(food.nutrients.micronutrients?.vitamin_c_mg).toBe(8.7);
    expect(food.nutrients.micronutrients?.vitamin_b6_mg).toBeCloseTo(0.367);
    const labels = food.servings.map((s) => s.label);
    expect(labels).toContain("1 Stück (mittel, 118 g)");
    expect(labels).toContain("1 Tasse (in Scheiben, 150 g)");
    expect(labels).toContain("1 Portion (126 g)");
    expect(labels).toContain("100 g");
    expect(food.servings.filter((s) => s.isDefault)).toEqual([expect.objectContaining({ label: "1 Stück (mittel, 118 g)" })]);
    expect(validateNormalizedFood(food).quality).toBe("complete");
  });

  it("maps Foundation foods (sugars 1063 fallback, unit-name portions)", () => {
    const food = mapFixture("usda-food-1105314-foundation.json");
    expect(food.nutrients).toMatchObject({ kcal: 97, proteinG: 0.74, carbsG: 23, sugarG: 15.8 });
    expect(food.servings.map((s) => s.label)).toEqual(
      expect.arrayContaining(["1 Stück (geschält, 115 g)", "1 Portion (140 g)"]),
    );
  });

  it("maps Branded details with GTIN, brand and household serving", () => {
    const food = mapFixture("usda-food-2560072-branded.json");
    expect(food).toMatchObject({ barcode: "0009800820023", brandName: "Nutella", category: "Cookies & Biscuits" });
    expect(food.name).toBe("Filled With Nutella Crispy Wafer");
    expect(food.nutrients).toMatchObject({ kcal: 500, sodiumMg: 227 });
    expect(food.servings.find((s) => s.isDefault)).toMatchObject({ label: "1 Riegel (22 g)", grams: 22 });
  });

  it("uses Atwater energy when 1008 is missing and kJ as last resort", () => {
    const base: UsdaFoodRecord = { fdcId: 1, dataType: "foundation_food", description: "Test", category: null, nutrients: new Map(), portions: [] };
    const atwater = mapUsdaRecord({ ...base, nutrients: new Map([[2048, 120], [2047, 125], [1003, 10], [1004, 5], [1005, 10]]) });
    expect(atwater.ok && atwater.food.nutrients.kcal).toBe(120);
    const kj = mapUsdaRecord({ ...base, nutrients: new Map([[1062, 418.4], [1003, 1]]) });
    expect(kj.ok && kj.food.nutrients.kcal).toBe(100);
    expect(kj.ok && kj.food.qualityFlags).toEqual(expect.arrayContaining(["energy_from_kj", "missing_fat", "missing_carbs"]));
    expect(mapUsdaRecord({ ...base, nutrients: new Map([[1162, 3]]) })).toEqual({ ok: false, reason: "no_nutrition_data" });
    expect(mapUsdaRecord({ ...base, description: " " })).toEqual({ ok: false, reason: "missing_name" });
  });

  it("drops imperial portions and ranks medium pieces first", () => {
    const servings = usdaPortionsToServings(
      [
        { amount: 1, unitName: "undetermined", modifier: "oz", description: null, gramWeight: 28.35 },
        { amount: 1, unitName: "undetermined", modifier: "large", description: null, gramWeight: 223 },
        { amount: 1, unitName: "undetermined", modifier: "medium (2-3/4\" to 3\" dia)", description: null, gramWeight: 182 },
        { amount: 2, unitName: "tablespoon", modifier: null, description: null, gramWeight: 30 },
        { amount: 1, unitName: "undetermined", modifier: "slice", description: null, gramWeight: 25 },
      ],
      "g",
    );
    expect(servings.map((s) => s.label)).toEqual([
      "1 Stück (mittel, 182 g)",
      "1 Stück (groß, 223 g)",
      "1 Scheibe (25 g)",
      "2 EL (30 g)",
    ]);
    expect(servings[0].isDefault).toBe(true);
  });

  it("maps search results (abridged nutrients, no portions)", () => {
    const list = loadFixture<{ foods: unknown[] }>("usda-search-banana.json").foods;
    const foods = list.map((f) => usdaRecordFromApi(f)).map((r) => r && mapUsdaRecord(r));
    expect(foods.every((r) => r?.ok)).toBe(true);
  });
});

describe("UsdaProvider", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("searches Foundation + SR Legacy with the API key", async () => {
    const { fetch, calls } = fixtureFetch({ "/foods/search": { body: loadFixture("usda-search-banana.json") } });
    const provider = new UsdaProvider({ fetch, apiKey: "KEY123", enabled: true, limiter: unlimited() });
    const foods = await provider.searchFoods("banana raw", { limit: 5 });
    expect(foods.map((f) => f.sourceId)).toEqual(["173944", "1105073", "169394", "1105314", "2747660"]);
    const url = new URL(calls[0].url);
    expect(url.searchParams.get("api_key")).toBe("KEY123");
    expect(url.searchParams.get("dataType")).toBe("Foundation,SR Legacy");
    expect(url.searchParams.get("pageSize")).toBe("5");
  });

  it("gets a food by fdcId and returns null for 404 / invalid ids", async () => {
    const { fetch, calls } = fixtureFetch({
      "/food/173944": { body: loadFixture("usda-food-173944-sr-legacy.json") },
      "/food/": { status: 404, body: { error: "not found" } },
    });
    const provider = new UsdaProvider({ fetch, enabled: true, limiter: unlimited() });
    expect((await provider.getFood("173944"))?.name).toBe("Bananas, raw");
    expect(await provider.getFood("999999999")).toBeNull();
    expect(await provider.getFood("abc")).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it("finds branded foods by exact GTIN only", async () => {
    const { fetch } = fixtureFetch({ "/foods/search": { body: loadFixture("usda-search-branded-nutella.json") } });
    const provider = new UsdaProvider({ fetch, enabled: true, limiter: unlimited() });
    expect((await provider.getFoodByBarcode("009800820023"))?.sourceId).toBe("2560072");
    expect(await provider.getFoodByBarcode("4000417025005")).toBeNull();
  });

  it("does no network when providers are disabled", async () => {
    vi.stubEnv("FOOD_EXTERNAL_PROVIDERS_ENABLED", "false");
    const fetch = vi.fn();
    const provider = new UsdaProvider({ fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await provider.searchFoods("apple")).toEqual([]);
    expect(await provider.getFood("173944")).toBeNull();
    expect(await provider.getFoodByBarcode("009800820023")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
