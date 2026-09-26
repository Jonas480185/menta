import { beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createTestDb } from "../../src/test/db";
import type { Db } from "../../src/server/db/create";
import type { NormalizedFood } from "../../src/server/food/types";
import {
  readSnapshotFile,
  readSnapshotManifest,
  writeSnapshotFile,
  writeSnapshotManifest,
} from "../../src/server/food/import/snapshot";
import { seedFoods } from "./seed-foods";

const food = (sourceId: string, over: Partial<NormalizedFood> = {}): NormalizedFood => ({
  source: "curated",
  sourceId,
  name: `Test ${sourceId}`,
  brandName: null,
  barcode: null,
  category: "Obst",
  language: "de",
  countries: ["DE"],
  imageUrl: null,
  nutrientBasis: "g",
  densityGPerMl: null,
  nutrients: { kcal: 52, proteinG: 0.3, carbsG: 13.8, fatG: 0.2, fiberG: 2.4, sugarG: null, micronutrients: { vitamin_c_mg: 4.6 } },
  servings: [
    { label: "1 Stück (mittel)", amount: 1, unit: "piece", grams: 180, isDefault: true },
    { label: "100 g", amount: 100, unit: "g", grams: 100 },
  ],
  popularity: 0,
  qualityFlags: [],
  ...over,
});

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "menta-seed-"));
  const a = await writeSnapshotFile(path.join(dir, "curated.jsonl.gz"), [food("b"), food("a")]);
  const b = await writeSnapshotFile(path.join(dir, "off.jsonl.gz"), [
    food("4006040000011", { source: "off", barcode: "4006040000011", brandName: "Marke", language: "de" }),
  ]);
  await writeSnapshotManifest(
    {
      version: 1,
      builtAt: "2026-09-26T00:00:00.000Z",
      files: [
        { file: "curated.jsonl.gz", source: "curated", description: "t", license: "CC0", ...a },
        { file: "off.jsonl.gz", source: "off", description: "t", license: "ODbL", ...b },
      ],
    },
    dir,
  );
});

describe("seed snapshot files", () => {
  it("round-trips foods sorted by key and restores omitted nulls", async () => {
    const rows = await collect(readSnapshotFile(path.join(dir, "curated.jsonl.gz")));
    expect(rows.map((r) => r.sourceId)).toEqual(["a", "b"]);
    expect(rows[0]).toEqual({ ...food("a"), nutrients: { ...food("a").nutrients, sugarG: undefined } });
    expect(rows[0].nutrients.sugarG ?? null).toBeNull();
  });

  it("is byte-identical for identical input", async () => {
    const x = await writeSnapshotFile(path.join(dir, "x.jsonl.gz"), [food("a"), food("b")]);
    const y = await writeSnapshotFile(path.join(dir, "y.jsonl.gz"), [food("b"), food("a")]);
    expect(x.sha256).toBe(y.sha256);
    expect(await readFile(path.join(dir, "x.jsonl.gz"))).toEqual(await readFile(path.join(dir, "y.jsonl.gz")));
  });

  it("reads the manifest (null when missing)", async () => {
    expect((await readSnapshotManifest(dir))?.files).toHaveLength(2);
    expect(await readSnapshotManifest(path.join(dir, "nope"))).toBeNull();
  });
});

describe("seedFoods", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it("is idempotent", async () => {
    const logs: string[] = [];
    const first = await seedFoods(db, { dir, log: (m) => logs.push(m) });
    expect(first).toEqual({ inserted: 3, updated: 0 });
    const second = await seedFoods(db, { dir, log: () => {} });
    expect(second).toEqual({ inserted: 0, updated: 3 });
    expect(logs.join("\n")).toContain("curated.jsonl.gz");
  });

  it("filters by source and tolerates a missing snapshot", async () => {
    expect(await seedFoods(db, { dir, only: ["off"], log: () => {} })).toEqual({ inserted: 0, updated: 1 });
    expect(await seedFoods(db, { dir: path.join(dir, "none"), log: () => {} })).toEqual({ inserted: 0, updated: 0 });
  });
});
