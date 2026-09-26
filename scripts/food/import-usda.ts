/**
 * Imports USDA FoodData Central bulk datasets (Foundation Foods + SR Legacy) into `foods`
 * (source "usda", language "en"). Downloads/extracts into data/raw/usda on first run.
 *
 *   pnpm exec tsx scripts/food/import-usda.ts [--datasets=foundation,sr_legacy]
 *        [--raw-dir=data/raw/usda] [--dry-run]
 *
 * Data: USDA FoodData Central, public domain (CC0 1.0).
 */
import "dotenv/config";
import { loadUsdaRecords, ensureUsdaDataset, USDA_DATASETS, type UsdaDatasetName } from "../../src/server/food/import/usda-bulk";
import { importFoods } from "../../src/server/food/import/pipeline";
import { mapUsdaRecord } from "../../src/server/food/normalize/usda";
import { argString, openDb, parseArgs, printCounts, progressLogger, runCli } from "./_cli";

runCli(async () => {
  const args = parseArgs();
  const rawDir = argString(args, "raw-dir", "data/raw/usda");
  const datasets = argString(args, "datasets", "foundation,sr_legacy").split(",") as UsdaDatasetName[];
  for (const d of datasets) if (!(d in USDA_DATASETS)) throw new Error(`Unknown dataset ${d} (foundation | sr_legacy)`);
  const dryRun = args["dry-run"] === true;
  const db = dryRun ? null : await openDb();

  for (const name of datasets) {
    const t0 = Date.now();
    const dir = await ensureUsdaDataset(name, rawDir, { log: console.log });
    const records = await loadUsdaRecords(dir, USDA_DATASETS[name].dataType);
    console.log(`${USDA_DATASETS[name].label}: ${records.size} records loaded in ${Date.now() - t0} ms`);
    const counts = await importFoods(db, records.values(), mapUsdaRecord, {
      dryRun,
      onProgress: progressLogger(name, 2000),
    });
    printCounts(`usda/${name}${dryRun ? " (dry run)" : ""}`, counts);
  }
});
