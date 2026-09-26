# Offline food seed snapshot

Committed, compressed snapshot of the public food database. `pnpm db:seed` (step `foods`,
`scripts/db/seed/02-foods.ts` → `scripts/food/seed-foods.ts`) loads it without network access,
API keys or downloads. Idempotent: upsert on `foods (source, source_id)`, servings synced by
label (stable ids), `fetched_at` = `builtAt` from `manifest.json`, so rows refreshed later from the
live APIs are never overwritten with older snapshot data.

| File | Source | Foods | Size | License |
|------|--------|------:|-----:|---------|
| `foods-curated.de.jsonl.gz` | Menta curation (`data/curated/generic-foods.de.json`), nutrients from USDA FDC by `fdcId` | 446 | 55 KiB | CC0 1.0 (USDA data) |
| `foods-usda.jsonl.gz` | USDA FoodData Central – Foundation Foods (2026-04-30) + SR Legacy (2018-04) | 8 229 | 902 KiB | CC0 1.0 / public domain |
| `foods-off.de.jsonl.gz` | Open Food Facts – most-scanned products sold in Germany (German-language), via search-a-licious + API v2 | 9 311 | 627 KiB | ODbL 1.0 |
| **Total** | | **17 986** | **1.55 MiB** | |

Built 2026-09-26 (`manifest.json` has exact counts, byte sizes and SHA-256 per file).

Pipeline stage counts at build time:

| Source | parsed | skipped by normalizer | invalid | duplicates | flagged (partial/suspect) | kept |
|--------|-------:|------:|------:|------:|------:|------:|
| curated | 446 | 0 | 0 | 0 | 0 | 446 (all `verified`) |
| USDA | 8 262 | 33 (no nutrition data) | 0 | 0 | 88 | 8 229 |
| OFF | 9 700 | 389 (no nutrition data / name / valid barcode) | 0 | 0 | 170 | 9 311 |

## Format

One `NormalizedFood` (`src/server/food/types.ts`) per line, JSON, gzip level 9, sorted by
`source:sourceId`, `null` fields omitted. Nutrients per 100 g (or 100 ml for `nutrientBasis: "ml"`),
already validated by `prepareFood`. Rebuilds with identical input are byte-identical.

## Rebuild

```bash
pnpm exec tsx scripts/food/import-usda.ts --dry-run          # downloads USDA CSVs to data/raw/usda once
pnpm exec tsx scripts/food/import-off.ts --fetch --dry-run    # crawls OFF (cached in data/raw/off)
pnpm exec tsx scripts/food/build-seed-snapshot.ts [--off-limit=10000] [--off-dump=openfoodfacts-products.jsonl.gz]
```

Then update the counts above. Keep the snapshot below 15 MB.

## Attribution (required)

- **Open Food Facts** – © Open Food Facts contributors, <https://world.openfoodfacts.org>.
  Database: [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/);
  individual contents: Database Contents License 1.0; product images: CC BY-SA 3.0.
  The app must show the source ("Daten: Open Food Facts (ODbL)") wherever OFF data is displayed,
  and derived databases that are distributed publicly must be shared under the ODbL.
- **USDA FoodData Central** – U.S. Department of Agriculture, Agricultural Research Service,
  <https://fdc.nal.usda.gov>. Public domain / CC0 1.0; citation requested:
  "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central."
