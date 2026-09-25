import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import type { Db } from "@/server/db/create";
import { foodBrands, foods, foodServings, foodUsage } from "@/server/db/schema";
import type { NormalizedFood } from "@/server/food/types";
import { mapOffProduct } from "@/server/food/normalize/off";
import { foodKey, getFoodDetails, getFoodDetailsByIds, upsertNormalizedFoods, upsertNormalizedFoodsDetailed } from "./persist";
import { LocalFoodProvider } from "./providers/local";
import { loadFixture } from "./providers/__fixtures__/load";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

function food(overrides: Partial<NormalizedFood> = {}): NormalizedFood {
  return {
    source: "curated",
    sourceId: "haferflocken",
    name: "Haferflocken",
    brandName: null,
    barcode: null,
    category: "Getreide",
    language: "de",
    countries: ["DE"],
    imageUrl: null,
    nutrientBasis: "g",
    densityGPerMl: null,
    nutrients: { kcal: 372, proteinG: 13.5, carbsG: 58.7, fatG: 7, fiberG: 10, saltG: 0.03 },
    servings: [{ label: "1 EL (10 g)", amount: 1, unit: "tbsp", grams: 10, isDefault: true }],
    popularity: 5,
    ...overrides,
  };
}

const offFood = (code: string) => {
  const r = mapOffProduct(loadFixture<{ product: unknown }>(`off-product-${code}.json`).product);
  if (!r.ok) throw new Error(r.reason);
  return r.food;
};

describe("upsertNormalizedFoods", () => {
  it("inserts a food with normalized text, quality, base + default serving", async () => {
    const ids = await upsertNormalizedFoods(db, [food({ sourceId: "hafer-1", name: "Haferflocken  zart" })]);
    const id = ids.get("curated:hafer-1")!;
    const details = await getFoodDetails(db, id);
    expect(details).toMatchObject({
      name: "Haferflocken zart",
      source: "curated",
      dataQuality: "verified",
      nutrients: { kcal: 372, sodiumMg: 12 },
      qualityFlags: ["sodium_derived"],
    });
    expect(details?.servings.map((s) => [s.label, s.isDefault])).toEqual([
      ["1 EL (10 g)", true],
      ["100 g", false],
    ]);
    const [row] = await db.select().from(foods).where(eq(foods.id, id));
    expect(row.nameNormalized).toBe("haferflocken zart");
    expect(row.fetchedAt).toBeInstanceOf(Date);
  });

  it("is idempotent: re-import updates, keeps ids and serving ids", async () => {
    const f = food({ sourceId: "hafer-2" });
    const first = await upsertNormalizedFoodsDetailed(db, [f]);
    expect(first.stats).toMatchObject({ inserted: 1, updated: 0 });
    const id = first.ids.get("curated:hafer-2")!;
    const servingsBefore = await db.select().from(foodServings).where(eq(foodServings.foodId, id));

    const second = await upsertNormalizedFoodsDetailed(db, [{ ...f, nutrients: { ...f.nutrients, kcal: 370 } }]);
    expect(second.stats).toMatchObject({ inserted: 0, updated: 1 });
    expect(second.ids.get("curated:hafer-2")).toBe(id);
    const servingsAfter = await db.select().from(foodServings).where(eq(foodServings.foodId, id));
    expect(servingsAfter.map((s) => s.id).sort()).toEqual(servingsBefore.map((s) => s.id).sort());
    expect((await getFoodDetails(db, id))?.nutrients.kcal).toBe(370);
  });

  it("syncs servings: keeps matching rows, removes stale ones, preserves user references", async () => {
    const ctx = await createTestUser(db);
    const ids = await upsertNormalizedFoods(db, [
      food({
        sourceId: "brot",
        servings: [
          { label: "1 Scheibe (45 g)", amount: 1, unit: "slice", grams: 45, isDefault: true },
          { label: "1 Brötchen (60 g)", amount: 1, unit: "piece", grams: 60 },
        ],
      }),
    ]);
    const id = ids.get("curated:brot")!;
    const slice = (await getFoodDetails(db, id))!.servings.find((s) => s.unit === "slice")!;
    await db.insert(foodUsage).values({ userId: ctx.userId, foodId: id, useCount: 1, lastServingId: slice.id });

    await upsertNormalizedFoods(db, [
      food({ sourceId: "brot", servings: [{ label: "1 Scheibe (45 g)", amount: 1, unit: "slice", grams: 45, isDefault: true }] }),
    ]);
    const after = (await getFoodDetails(db, id))!;
    expect(after.servings.map((s) => s.label)).toEqual(["1 Scheibe (45 g)", "100 g"]);
    expect(after.servings[0].id).toBe(slice.id);
    const [usage] = await db.select().from(foodUsage).where(eq(foodUsage.foodId, id));
    expect(usage.lastServingId).toBe(slice.id);
  });

  it("rejects invalid foods and reports stage counts", async () => {
    const report = await upsertNormalizedFoodsDetailed(db, [
      food({ sourceId: "bad-1", nutrients: { kcal: 950, proteinG: 0, carbsG: 0, fatG: 100 } }),
      food({ sourceId: "bad-2", name: "" }),
      food({ sourceId: null }),
      food({ sourceId: "ok-1", nutrients: { kcal: 150, proteinG: 13.5, carbsG: 58.7, fatG: 7 } }),
      food({ sourceId: "ok-1" }),
      food({ sourceId: "ok-2", nutrients: { kcal: 150, proteinG: 13.5, carbsG: 58.7, fatG: 7 } }),
    ]);
    // for the duplicate key the richer (non-suspect) record wins; ok-2 stays flagged
    expect(report.stats).toMatchObject({ received: 6, invalid: 3, duplicates: 1, inserted: 2, flagged: 1 });
    expect(report.errorCounts).toMatchObject({ kcal_exceeds_max: 1, missing_name: 1, missing_source_id: 1 });
    expect(report.ids.has("curated:bad-1")).toBe(false);
    expect(report.ids.has("curated:ok-1")).toBe(true);
  });

  it("drops invalid servings but always keeps 100 g and exactly one default", async () => {
    const ids = await upsertNormalizedFoods(db, [
      food({
        sourceId: "serv",
        servings: [
          { label: "kaputt", amount: 1, unit: "piece", grams: 0 },
          { label: "1 Stück (50 g)", amount: 1, unit: "piece", grams: 50 },
          { label: "1 Stück (80 g)", amount: 1, unit: "piece", grams: 80, isDefault: true },
        ],
      }),
    ]);
    const d = (await getFoodDetails(db, ids.get("curated:serv")!))!;
    expect(d.servings.map((s) => s.label)).toEqual(["1 Stück (50 g)", "1 Stück (80 g)", "100 g"]);
    expect(d.servings.filter((s) => s.isDefault).map((s) => s.label)).toEqual(["1 Stück (80 g)"]);
  });

  it("upserts brands once and links them", async () => {
    await upsertNormalizedFoods(db, [
      food({ source: "off", sourceId: "4000417025005", barcode: "4000417025005", brandName: "Ritter Sport" }),
      food({ source: "off", sourceId: "4000417025012", barcode: "4000417025012", brandName: "RITTER SPORT " }),
    ]);
    const brands = await db.select().from(foodBrands).where(eq(foodBrands.nameNormalized, "ritter sport"));
    expect(brands).toHaveLength(1);
    const rows = await db.select().from(foods).where(eq(foods.brandId, brands[0].id));
    expect(rows).toHaveLength(2);
  });

  it("dedupes by barcode across sources: richer record stays, the other is archived", async () => {
    const off = offFood("4014400400007"); // German, complete, with brand + image
    const usdaPoor: NormalizedFood = {
      ...food({ source: "usda", sourceId: "999001", name: "TOFFIFEE", language: "en", barcode: "04014400400007" }),
      nutrients: { kcal: 520, proteinG: 6, carbsG: 59, fatG: 29 },
    };
    const first = await upsertNormalizedFoodsDetailed(db, [usdaPoor]);
    const usdaId = first.ids.get("usda:999001")!;
    const second = await upsertNormalizedFoodsDetailed(db, [off]);
    expect(second.stats).toMatchObject({ duplicates: 1, archived: 1, inserted: 1 });
    const [usdaRow] = await db.select().from(foods).where(eq(foods.id, usdaId));
    expect(usdaRow.isArchived).toBe(true);

    // re-importing the poorer record maps it to the surviving OFF row instead of reviving it
    const third = await upsertNormalizedFoodsDetailed(db, [usdaPoor]);
    expect(third.ids.get("usda:999001")).toBe(second.ids.get(foodKey(off)));
    expect(third.stats.inserted + third.stats.updated).toBe(0);
    const [still] = await db.select().from(foods).where(eq(foods.id, usdaId));
    expect(still.isArchived).toBe(true);
  });

  it("dedupes barcodes within one batch and maps both keys to the winner", async () => {
    const a = food({ source: "off", sourceId: "5449000000996", barcode: "5449000000996", language: "de", imageUrl: "https://x/y.jpg" });
    const b = food({ source: "usda", sourceId: "999002", barcode: "05449000000996", language: "en" });
    const report = await upsertNormalizedFoodsDetailed(db, [b, a]);
    expect(report.stats.duplicates).toBe(1);
    expect(report.ids.get("usda:999002")).toBe(report.ids.get("off:5449000000996"));
  });

  it("never lowers popularity on re-import", async () => {
    const f = food({ sourceId: "pop", popularity: 10 });
    const ids = await upsertNormalizedFoods(db, [f]);
    await db.update(foods).set({ popularity: 50 }).where(eq(foods.id, ids.get("curated:pop")!));
    await upsertNormalizedFoods(db, [{ ...f, popularity: 20 }]);
    expect((await getFoodDetails(db, ids.get("curated:pop")!))?.popularity).toBe(50);
  });

  it("never overwrites a row that was refreshed more recently (e.g. old seed snapshot)", async () => {
    const f = food({ sourceId: "fresh", nutrients: { kcal: 372, proteinG: 13.5, carbsG: 58.7, fatG: 7 } });
    const ids = await upsertNormalizedFoods(db, [f], { fetchedAt: new Date("2026-09-01") });
    const stale = { ...f, nutrients: { ...f.nutrients, kcal: 360 } };
    const report = await upsertNormalizedFoodsDetailed(db, [stale], { fetchedAt: new Date("2026-01-01") });
    expect(report.stats).toMatchObject({ inserted: 0, updated: 0, skippedNewer: 1 });
    expect(report.ids.get("curated:fresh")).toBe(ids.get("curated:fresh"));
    expect((await getFoodDetails(db, ids.get("curated:fresh")!))?.nutrients.kcal).toBe(372);
  });

  it("handles thousands of rows in batches", async () => {
    const many = Array.from({ length: 1200 }, (_, i) => food({ source: "usda", sourceId: `bulk-${i}`, name: `Bulk Food ${i}` }));
    const report = await upsertNormalizedFoodsDetailed(db, many, { batchSize: 500 });
    expect(report.stats.inserted).toBe(1200);
    expect(report.ids.size).toBe(1200);
  });
});

describe("getFoodDetails", () => {
  it("returns null for unknown or malformed ids and preserves order in batch reads", async () => {
    expect(await getFoodDetails(db, "not-a-uuid")).toBeNull();
    expect(await getFoodDetails(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
    const ids = await upsertNormalizedFoods(db, [food({ sourceId: "o1", name: "Eins" }), food({ sourceId: "o2", name: "Zwei" })]);
    const list = await getFoodDetailsByIds(db, [ids.get("curated:o2")!, ids.get("curated:o1")!]);
    expect(list.map((f) => f.name)).toEqual(["Zwei", "Eins"]);
  });
});

describe("LocalFoodProvider", () => {
  it("finds public foods by tokens, barcode variants and id", async () => {
    const ids = await upsertNormalizedFoods(db, [
      offFood("4102640455007"),
      food({ sourceId: "vollmilch", name: "Vollmilch 3,5 %", nutrientBasis: "ml", popularity: 100 }),
    ]);
    const provider = new LocalFoodProvider(db);
    const results = await provider.searchFoods("frische vollmilch");
    expect(results.map((r) => r.name)).toEqual(["Frische Vollmilch"]);
    expect((await provider.searchFoods("Vollmilch")).length).toBe(2);
    expect(await provider.searchFoods("   ")).toEqual([]);

    const byBarcode = await provider.getFoodByBarcode("04102640455007");
    expect(byBarcode?.id).toBe(ids.get("off:4102640455007"));
    expect(await provider.getFoodByBarcode("4098765432108")).toBeNull();
    expect((await provider.getFood(ids.get("curated:vollmilch")!))?.name).toBe("Vollmilch 3,5 %");
    expect(await provider.getFood("nope")).toBeNull();
  });

  it("does not return private user foods", async () => {
    const ctx = await createTestUser(db);
    const [row] = await db
      .insert(foods)
      .values({
        source: "user",
        ownerUserId: ctx.userId,
        visibility: "private",
        name: "Omas Geheimkuchen",
        nameNormalized: "omas geheimkuchen",
        kcal: 400,
        proteinG: 5,
        carbsG: 50,
        fatG: 20,
      })
      .returning();
    const provider = new LocalFoodProvider(db);
    expect(await provider.searchFoods("geheimkuchen")).toEqual([]);
    expect(await provider.getFood(row.id)).toBeNull();
  });
});

describe("constraint safety", () => {
  it("rejects rows that would violate DB CHECKs instead of failing the batch", async () => {
    const report = await upsertNormalizedFoodsDetailed(db, [
      food({ sourceId: "punct", name: "!!! ---" }),
      food({ source: "user", sourceId: "u1" }),
      food({ sourceId: "dens", densityGPerMl: -1, popularity: -5 }),
      food({ sourceId: "honey-ml", nutrientBasis: "ml", nutrients: { kcal: 430, proteinG: 0.4, carbsG: 115, fatG: 0 } }),
    ]);
    expect(report.stats).toMatchObject({ invalid: 2, inserted: 2 });
    expect(report.errorCounts).toMatchObject({ missing_name: 1, unsupported_source: 1 });
    const dens = await getFoodDetails(db, report.ids.get("curated:dens")!);
    expect(dens?.densityGPerMl).toBeNull();
    expect(dens?.popularity).toBe(0);
  });
});
