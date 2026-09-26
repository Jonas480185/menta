import { beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createTestDb } from "@/test/db";
import type { Db } from "@/server/db/create";
import type { NormalizedFood } from "@/server/food/types";
import { mapOffProduct } from "@/server/food/normalize/off";
import { formatImportCounts, importFoods } from "./pipeline";
import { readCachedOffPages, readOffJsonl } from "./off-dump";

const product = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
  product_name: `Produkt ${code}`,
  countries_tags: ["en:germany"],
  nutriments: { "energy-kcal_100g": 120, proteins_100g: 5, carbohydrates_100g: 15, fat_100g: 4 },
  ...extra,
});

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "menta-off-"));
});

describe("OFF offline readers", () => {
  it("streams a gzipped JSONL dump with country filter and skips broken lines", async () => {
    const lines = [
      JSON.stringify(product("4000000000001")),
      "{not json en:germany",
      JSON.stringify(product("4000000000002", { countries_tags: ["en:france"] })),
      JSON.stringify(product("4000000000003")),
    ].join("\n");
    const file = path.join(dir, "dump.jsonl.gz");
    await writeFile(file, gzipSync(lines));
    let bad = 0;
    const rows = await collect(readOffJsonl(file, { countries: ["en:germany"], onInvalidLine: () => bad++ }));
    expect(rows.map((r) => (r as { code: string }).code)).toEqual(["4000000000001", "4000000000003"]);
    expect(bad).toBe(1);
    expect(await collect(readOffJsonl(file, { limit: 1 }))).toHaveLength(1);
  });

  it("reads cached API pages once per barcode", async () => {
    const cache = path.join(dir, "cache");
    await import("node:fs/promises").then((fs) => fs.mkdir(cache));
    await writeFile(path.join(cache, "api-germany_x_any_ps50-p01.json"), JSON.stringify({ products: [product("1"), product("2")] }));
    await writeFile(path.join(cache, "api-germany_x_breads_ps50-p01.json"), JSON.stringify({ products: [product("2"), product("3")] }));
    const rows = await collect(readCachedOffPages(cache));
    expect(rows.map((r) => (r as { code: string }).code)).toEqual(["1", "2", "3"]);
    expect(await collect(readCachedOffPages(path.join(dir, "missing")))).toEqual([]);
  });
});

describe("importFoods", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });

  const records = [
    product("4006040000011"),
    product("4006040000011"), // same barcode twice
    { code: "4006040000028" }, // no name / nutrition → skipped by the normalizer
    product("4006040000035", { nutriments: { "energy-kcal_100g": 2000, fat_100g: 100 } }), // invalid
  ];

  it("counts every stage in a dry run without a database", async () => {
    const c = await importFoods(null, records, mapOffProduct, { dryRun: true });
    expect(c).toMatchObject({ parsed: 4, invalid: 1, duplicates: 1, inserted: 1 });
    expect(Object.values(c.skipped).reduce((a, b) => a + b, 0)).toBe(1);
    expect(formatImportCounts("test", c)).toContain("parsed 4");
  });

  it("upserts idempotently", async () => {
    const first = await importFoods(db, records, mapOffProduct, { chunkSize: 2 });
    expect(first).toMatchObject({ parsed: 4, invalid: 1, inserted: 1 });
    const second = await importFoods(db, records, mapOffProduct);
    expect(second).toMatchObject({ inserted: 0, updated: 1 });
  });

  it("accepts pre-normalized foods", async () => {
    const food: NormalizedFood = {
      source: "curated", sourceId: "pipeline-test", name: "Testbrot", brandName: null, barcode: null,
      category: null, language: "de", countries: null, imageUrl: null, nutrientBasis: "g", densityGPerMl: null,
      nutrients: { kcal: 250, proteinG: 8, carbsG: 48, fatG: 2 }, servings: [],
    };
    const c = await importFoods(db, [food], (f) => ({ ok: true, food: f }));
    expect(c.inserted).toBe(1);
  });
});
