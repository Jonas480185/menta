/**
 * Imports Open Food Facts products into `foods` (source "off").
 *
 *   # from API pages cached by the crawler (default, offline)
 *   pnpm exec tsx scripts/food/import-off.ts [--cache-dir=data/raw/off]
 *   # crawl popular German products first (10 req/min, cached; anonymous: 10 pages/search)
 *   pnpm exec tsx scripts/food/import-off.ts --fetch --limit=3000
 *   # stream the full JSONL dump (constant memory), German products only
 *   pnpm exec tsx scripts/food/import-off.ts --file=openfoodfacts-products.jsonl.gz [--country=en:germany|all] [--limit=N]
 *   … [--dry-run]
 *
 * Data: © Open Food Facts contributors, ODbL 1.0 – attribution required in the UI.
 */
import "dotenv/config";
import { fetchOffPopularProducts } from "../../src/server/food/import/off-api";
import { readCachedOffPages, readOffJsonl } from "../../src/server/food/import/off-dump";
import { importFoods } from "../../src/server/food/import/pipeline";
import { mapOffProduct } from "../../src/server/food/normalize/off";
import { argInt, argString, openDb, parseArgs, printCounts, progressLogger, runCli } from "./_cli";

runCli(async () => {
  const args = parseArgs();
  const dryRun = args["dry-run"] === true;
  const cacheDir = argString(args, "cache-dir", "data/raw/off");
  const limit = argInt(args, "limit");
  let records: AsyncIterable<unknown>;
  let label: string;
  if (typeof args.file === "string") {
    const country = argString(args, "country", "en:germany");
    let badLines = 0;
    records = readOffJsonl(args.file, {
      countries: country === "all" ? undefined : [country],
      limit,
      onInvalidLine: () => badLines++,
    });
    label = `off/dump (${country})`;
    process.on("exit", () => badLines && console.log(`  (${badLines} unparsable lines skipped)`));
  } else if (args.fetch) {
    records = fetchOffPopularProducts({ limit: limit ?? 3000, cacheDir, log: console.log });
    label = "off/api";
  } else {
    records = readCachedOffPages(cacheDir);
    label = `off/cache (${cacheDir})`;
  }
  const db = dryRun ? null : await openDb();
  const counts = await importFoods(db, records, mapOffProduct, { dryRun, onProgress: progressLogger("off", 5000) });
  printCounts(`${label}${dryRun ? " (dry run)" : ""}`, counts);
});
