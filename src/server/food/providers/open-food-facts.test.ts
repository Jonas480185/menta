import { afterEach, describe, expect, it, vi } from "vitest";
import { mapOffProduct } from "@/server/food/normalize/off";
import { validateNormalizedFood } from "@/domain/food/validation";
import { OpenFoodFactsProvider } from "./open-food-facts";
import { TokenBucket } from "./http";
import { resetEnvCache } from "@/lib/env";
import { fixtureFetch, loadFixture } from "./__fixtures__/load";

type ProductResponse = { product: Record<string, unknown> };
const product = (code: string) => loadFixture<ProductResponse>(`off-product-${code}.json`).product;

function mapOk(raw: unknown) {
  const r = mapOffProduct(raw);
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.food;
}

const unlimited = () => new TokenBucket({ capacity: 1000, requests: 1000, perMs: 1 });

describe("mapOffProduct", () => {
  it("maps a German product with serving and package (Toffifee)", () => {
    const food = mapOk(product("4014400400007"));
    expect(food).toMatchObject({
      source: "off",
      sourceId: "4014400400007",
      barcode: "4014400400007",
      name: "Toffifee 15er",
      brandName: "Storck",
      language: "de",
      nutrientBasis: "g",
      popularity: expect.any(Number),
    });
    expect(food.countries).toContain("DE");
    expect(food.nutrients).toMatchObject({ kcal: 521, proteinG: 6, carbsG: 58.9, fatG: 29, sugarG: 48.8, saltG: 0.27 });
    expect(food.nutrients.sodiumMg).toBeCloseTo(0.11);
    expect(food.servings).toEqual([
      { label: "1 Portion (8 g)", amount: 1, unit: "serving", grams: 8, isDefault: true },
      { label: "1 Packung (125 g)", amount: 1, unit: "package", grams: 125, isDefault: false },
      { label: "100 g", amount: 100, unit: "g", grams: 100, isDefault: false },
    ]);
    // validation later repairs the broken sodium value
    const v = validateNormalizedFood(food);
    expect(v.flags).toContain("salt_sodium_mismatch");
    expect(v.nutrients.sodiumMg).toBe(108);
  });

  it("prefers product_name_de over the main name", () => {
    const food = mapOk(product("4000417025005"));
    expect(food.name).toBe("Marzipan");
    expect(food.language).toBe("de");
    expect(food.servings[0]).toMatchObject({ label: "1 Würfel (6,5 g)", unit: "piece", isDefault: true });
    expect(food.category).toBe("nl:Koeken/Chocolade/Snoep");
  });

  it("detects liquids from quantity even if nutrition_data_per says 100g (Coca-Cola)", () => {
    const food = mapOk(product("5449000000996"));
    expect(food.nutrientBasis).toBe("ml");
    expect(food.servings.find((s) => s.isDefault)).toMatchObject({ label: "1 Portion (330 ml)", grams: 330 });
    expect(food.servings.map((s) => s.label)).toContain("100 ml");
  });

  it("maps milk per 100 ml with package serving and default 100 ml", () => {
    const food = mapOk(product("4102640455007"));
    expect(food.nutrientBasis).toBe("ml");
    expect(food.nutrients).toMatchObject({ kcal: 63.9, proteinG: 3.3, fatG: 3.5, sodiumMg: 52 });
    expect(food.servings.find((s) => s.isDefault)?.label).toBe("100 ml");
    expect(food.category).toBe("en:whole-milks");
  });

  it("uses kJ when the kcal field contradicts macros and kJ (Knäckebrot)", () => {
    const food = mapOk(product("20171841"));
    expect(food.nutrients.kcal).toBe(321.5);
    expect(food.qualityFlags).toContain("energy_from_kj");
    expect(validateNormalizedFood(food).flags).not.toContain("energy_mismatch");
  });

  it("maps minerals and micronutrients to mg/µg and skips zero placeholders", () => {
    const food = mapOk({
      code: "4000417025005",
      product_name: "Test",
      nutriments: {
        "energy-kcal_100g": 100,
        proteins_100g: 5,
        carbohydrates_100g: 10,
        fat_100g: 4,
        iron_100g: 0.0021,
        calcium_100g: 0.12,
        potassium_100g: 0.3,
        "vitamin-c_100g": 0.012,
        "vitamin-d_100g": 0.0000025,
        "vitamin-a_100g": 0,
        alcohol_100g: 5,
      },
    });
    expect(food.nutrients.ironMg).toBeCloseTo(2.1);
    expect(food.nutrients.calciumMg).toBe(120);
    expect(food.nutrients.potassiumMg).toBe(300);
    expect(food.nutrients.micronutrients).toEqual({ vitamin_c_mg: 12, vitamin_d_ug: 2.5, alcohol_g: 3.95 });
  });

  it("derives kcal from kJ when only kJ is present and flags missing macros", () => {
    const food = mapOk({ code: "4000417025005", product_name: "X", nutriments: { "energy-kj_100g": 418.4, fat_100g: 1 } });
    expect(food.nutrients.kcal).toBe(100);
    expect(food.qualityFlags).toEqual(expect.arrayContaining(["energy_from_kj", "missing_protein", "missing_carbs"]));
    expect(validateNormalizedFood(food).quality).toBe("partial");
  });

  it.each([
    [{ code: "123", product_name: "x", nutriments: { "energy-kcal_100g": 1 } }, "invalid_barcode"],
    [{ code: "4000417025005", nutriments: { "energy-kcal_100g": 1 } }, "missing_name"],
    [{ code: "4000417025005", product_name: "x", nutriments: {} }, "no_nutrition_data"],
    [{ product_name: "x" }, "invalid_payload"],
    ["garbage", "invalid_payload"],
  ])("skips unusable products (%#)", (raw, reason) => {
    expect(mapOffProduct(raw)).toEqual({ ok: false, reason });
  });

  it("accepts string numbers, brand arrays and flags invalid checksums", () => {
    const food = mapOk({
      code: "4000417025006",
      product_name: "  Müsli   Crunchy ",
      brands: ["", " Kölln "],
      nutriments: { "energy-kcal_100g": "420", proteins_100g: "9,5", carbohydrates_100g: 60, fat_100g: 15 },
      unique_scans_n: "12",
    });
    expect(food.name).toBe("Müsli Crunchy");
    expect(food.brandName).toBe("Kölln");
    expect(food.nutrients.proteinG).toBe(9.5);
    expect(food.popularity).toBe(12);
    expect(food.qualityFlags).toContain("barcode_checksum_invalid");
  });

  it("maps every product of a recorded v2 search page", () => {
    const page = loadFixture<{ products: unknown[] }>("off-v2-search-germany-p2.json");
    const foods = page.products.map((p) => mapOffProduct(p)).filter((r) => r.ok);
    expect(foods.length).toBe(page.products.length);
  });
});

describe("OpenFoodFactsProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it("looks up a barcode via API v2 with fields and User-Agent", async () => {
    const { fetch, calls } = fixtureFetch({ "/api/v2/product/4014400400007": { body: loadFixture("off-product-4014400400007.json") } });
    const provider = new OpenFoodFactsProvider({ fetch, enabled: true, userAgent: "TestApp/1.0 (t@example.com)", limiters: { product: unlimited() } });
    const food = await provider.getFoodByBarcode("40 14400 400007");
    expect(food?.name).toBe("Toffifee 15er");
    expect(calls[0].url).toContain("fields=code%2Cproduct_name");
    expect(calls[0].headers["User-Agent"]).toBe("TestApp/1.0 (t@example.com)");
  });

  it("returns null for unknown barcodes (404 / status 0) and invalid input", async () => {
    const { fetch, calls } = fixtureFetch({
      "/api/v2/product/": { status: 404, body: loadFixture("off-product-not-found.json") },
    });
    const provider = new OpenFoodFactsProvider({ fetch, enabled: true, limiters: { product: unlimited() } });
    expect(await provider.getFoodByBarcode("4098765432108")).toBeNull();
    expect(await provider.getFood("4098765432108")).toBeNull();
    expect(await provider.getFoodByBarcode("12")).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it("searches search-a-licious with German language preference and country re-ranking", async () => {
    const { fetch, calls } = fixtureFetch({ "search.openfoodfacts.org/search": { body: loadFixture("off-sal-search-haferflocken.json") } });
    const provider = new OpenFoodFactsProvider({ fetch, enabled: true, limiters: { search: unlimited() } });
    const foods = await provider.searchFoods("Haferflocken", { limit: 3 });
    expect(foods).toHaveLength(3);
    expect(foods.every((f) => f.source === "off" && f.countries?.includes("DE"))).toBe(true);
    const url = new URL(calls[0].url);
    expect(url.searchParams.get("q")).toBe("Haferflocken");
    expect(url.searchParams.get("langs")).toBe("de,en");
  });

  it("does no network when FOOD_EXTERNAL_PROVIDERS_ENABLED=false", async () => {
    vi.stubEnv("FOOD_EXTERNAL_PROVIDERS_ENABLED", "false");
    resetEnvCache();
    const fetch = vi.fn();
    const provider = new OpenFoodFactsProvider({ fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await provider.searchFoods("Milch")).toEqual([]);
    expect(await provider.getFoodByBarcode("4014400400007")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores too-short queries", async () => {
    const fetch = vi.fn();
    const provider = new OpenFoodFactsProvider({ fetch: fetch as unknown as typeof globalThis.fetch, enabled: true });
    expect(await provider.searchFoods(" a ")).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries a 503 from OFF and then succeeds", async () => {
    let n = 0;
    const fetch = vi.fn(async () =>
      ++n === 1 ? new Response("<html>busy</html>", { status: 503 }) : new Response(JSON.stringify(loadFixture("off-product-20171841.json"))),
    );
    const provider = new OpenFoodFactsProvider({
      fetch: fetch as unknown as typeof globalThis.fetch,
      enabled: true,
      limiters: { product: unlimited() },
      sleep: async () => {},
    });
    expect((await provider.getFoodByBarcode("20171841"))?.sourceId).toBe("20171841");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
