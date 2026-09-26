/**
 * Imports the curated German basics (data/curated/generic-foods.de.json) into `foods`
 * (source "curated", language "de", dataQuality "verified"). Nutrients are resolved from the
 * USDA bulk data by fdcId; every fdcId must exist (exit 1 otherwise).
 *
 *   pnpm exec tsx scripts/food/import-curated.ts [--file=…] [--raw-dir=data/raw/usda] [--dry-run]
 */
import "dotenv/config";
import { buildCuratedFoods, CURATED_FOODS_PATH, loadCuratedFoods } from "../../src/server/food/import/curated";
import { loadUsdaBulk } from "../../src/server/food/import/usda-bulk";
import { importFoods } from "../../src/server/food/import/pipeline";
import { argString, openDb, parseArgs, printCounts, runCli } from "./_cli";

runCli(async () => {
  const args = parseArgs();
  const dryRun = args["dry-run"] === true;
  const entries = await loadCuratedFoods(argString(args, "file", CURATED_FOODS_PATH));
  const usda = await loadUsdaBulk(argString(args, "raw-dir", "data/raw/usda"), ["foundation", "sr_legacy"], { log: console.log });
  const built = buildCuratedFoods(entries, usda);
  console.log(`curated: ${entries.length} entries, ${built.foods.length} resolved against ${usda.size} USDA foods`);
  if (built.missing.length) {
    for (const m of built.missing) console.error(`  ✗ ${m.id}: fdcId ${m.fdcId} → ${m.reason}`);
    throw new Error(`${built.missing.length} curated entries could not be resolved`);
  }
  const db = dryRun ? null : await openDb();
  const counts = await importFoods(db, built.foods, (food) => ({ ok: true, food }), { dryRun });
  printCounts(`curated${dryRun ? " (dry run)" : ""}`, counts);
});
