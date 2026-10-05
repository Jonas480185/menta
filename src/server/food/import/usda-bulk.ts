/**
 * USDA FoodData Central bulk CSV datasets (Foundation Foods, SR Legacy): download (cached in
 * data/raw/usda, gitignored), extract, stream-parse into UsdaFoodRecord.
 * License: CC0 1.0 / public domain, please cite "USDA FoodData Central".
 */
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { USDA_MICRONUTRIENTS, USDA_NUTRIENT, type UsdaFoodRecord } from "@/server/food/normalize/usda";
import { readCsvRecords } from "./csv";
import { extractZip } from "./zip";

export const USDA_DOWNLOAD_BASE = "https://fdc.nal.usda.gov/fdc-datasets/";

export const USDA_DATASETS = {
  foundation: {
    zip: "FoodData_Central_foundation_food_csv_2026-04-30.zip",
    dataType: "foundation_food",
    label: "USDA Foundation Foods (2026-04-30)",
  },
  sr_legacy: {
    zip: "FoodData_Central_sr_legacy_food_csv_2018-04.zip",
    dataType: "sr_legacy_food",
    label: "USDA SR Legacy (2018-04)",
  },
} as const;
export type UsdaDatasetName = keyof typeof USDA_DATASETS;

const NEEDED_FILES = new Set(["food.csv", "food_nutrient.csv", "food_portion.csv", "food_category.csv", "measure_unit.csv"]);

const USED_NUTRIENT_IDS = new Set<number>([
  ...Object.values(USDA_NUTRIENT),
  ...Object.keys(USDA_MICRONUTRIENTS).map(Number),
  1177,
]);

export interface EnsureDatasetOptions {
  fetch?: typeof fetch;
  log?: (msg: string) => void;
}

/** Downloads (if missing) and extracts a dataset; returns the directory with the CSV files. */
export async function ensureUsdaDataset(
  name: UsdaDatasetName,
  rawDir: string,
  opts: EnsureDatasetOptions = {},
): Promise<string> {
  const ds = USDA_DATASETS[name];
  const log = opts.log ?? (() => {});
  await mkdir(rawDir, { recursive: true });
  const zipPath = path.join(rawDir, ds.zip);
  const outDir = path.join(rawDir, ds.zip.replace(/\.zip$/, ""));
  if (!existsSync(zipPath)) {
    const url = USDA_DOWNLOAD_BASE + ds.zip;
    log(`↓ downloading ${url}`);
    const res = await (opts.fetch ?? fetch)(url);
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${url}`);
    const tmp = `${zipPath}.part`;
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(tmp));
    await rename(tmp, zipPath);
  }
  if (![...NEEDED_FILES].every((f) => existsSync(path.join(outDir, f)))) {
    log(`⇢ extracting ${ds.zip}`);
    await extractZip(zipPath, outDir, (base) => NEEDED_FILES.has(base));
  }
  return outDir;
}

const numOrNull = (s: string | undefined) => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * Parses a dataset directory into records keyed by fdcId. Only foods of `dataType` are kept
 * (Foundation bundles also contain sample/acquisition rows).
 */
export async function loadUsdaRecords(dir: string, dataType: string): Promise<Map<number, UsdaFoodRecord>> {
  const categories = new Map<string, string>();
  for await (const r of readCsvRecords(path.join(dir, "food_category.csv"))) categories.set(r.id, r.description);
  const units = new Map<string, string>();
  for await (const r of readCsvRecords(path.join(dir, "measure_unit.csv"))) units.set(r.id, r.name);

  const records = new Map<number, UsdaFoodRecord>();
  for await (const r of readCsvRecords(path.join(dir, "food.csv"))) {
    if (r.data_type !== dataType) continue;
    const fdcId = Number(r.fdc_id);
    if (!Number.isInteger(fdcId)) continue;
    records.set(fdcId, {
      fdcId,
      dataType,
      description: r.description,
      category: categories.get(r.food_category_id) ?? null,
      nutrients: new Map(),
      portions: [],
    });
  }

  for await (const r of readCsvRecords(path.join(dir, "food_nutrient.csv"))) {
    const rec = records.get(Number(r.fdc_id));
    if (!rec) continue;
    const id = Number(r.nutrient_id);
    if (!USED_NUTRIENT_IDS.has(id)) continue;
    const amount = numOrNull(r.amount);
    if (amount !== null) rec.nutrients.set(id, amount);
  }

  for await (const r of readCsvRecords(path.join(dir, "food_portion.csv"))) {
    const rec = records.get(Number(r.fdc_id));
    if (!rec) continue;
    const gramWeight = numOrNull(r.gram_weight);
    if (!gramWeight || gramWeight <= 0) continue;
    rec.portions.push({
      amount: numOrNull(r.amount),
      unitName: units.get(r.measure_unit_id) ?? null,
      modifier: r.modifier || null,
      description: r.portion_description || null,
      gramWeight,
    });
  }
  return records;
}

/**
 * Ensures and loads several datasets into one fdcId → record map (fdcIds are unique across
 * FDC data types). Default: Foundation + SR Legacy.
 */
export async function loadUsdaBulk(
  rawDir: string,
  datasets: readonly UsdaDatasetName[] = ["foundation", "sr_legacy"],
  opts: EnsureDatasetOptions = {},
): Promise<Map<number, UsdaFoodRecord>> {
  const all = new Map<number, UsdaFoodRecord>();
  for (const name of datasets) {
    const dir = await ensureUsdaDataset(name, rawDir, opts);
    for (const [id, rec] of await loadUsdaRecords(dir, USDA_DATASETS[name].dataType)) all.set(id, rec);
  }
  return all;
}
