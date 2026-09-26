/**
 * Builds the committed offline seed snapshot (data/seed/*.jsonl.gz + manifest.json) from
 * local raw data – no network access:
 *   - curated German basics (data/curated/generic-foods.de.json, nutrients via USDA fdcId)
 *   - USDA Foundation Foods + SR Legacy (data/raw/usda, downloaded by import-usda.ts)
 *   - Open Food Facts, popular German products (data/raw/off, cached by import-off.ts --fetch)
 *
 *   pnpm exec tsx scripts/food/build-seed-snapshot.ts [--off-limit=8000] [--off-dump=<jsonl.gz>]
 *
 * Every record passes the same prepare/validate/dedupe step as the DB import; invalid ones
 * are dropped here so the seed stays fast. Update data/seed/README.md counts after a rebuild.
 */
import "dotenv/config";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { NormalizedFood } from "../../src/server/food/types";
import { buildCuratedFoods, loadCuratedFoods } from "../../src/server/food/import/curated";
import { loadUsdaBulk } from "../../src/server/food/import/usda-bulk";
import { readCachedOffPages, readOffJsonl } from "../../src/server/food/import/off-dump";
import { mapUsdaRecord } from "../../src/server/food/normalize/usda";
import { mapOffProduct } from "../../src/server/food/normalize/off";
import { dedupePrepared, prepareFood, type PreparedFood } from "../../src/server/food/normalize/prepare";
import { SEED_DIR, writeSnapshotFile, writeSnapshotManifest, type SnapshotFileInfo } from "../../src/server/food/import/snapshot";
import { argInt, argString, parseArgs, runCli } from "./_cli";

type Mapped = { ok: true; food: NormalizedFood } | { ok: false; reason: string };

async function prepareAll(label: string, records: AsyncIterable<unknown> | Iterable<unknown>, map: (r: never) => Mapped, limit?: number) {
  let parsed = 0;
  let skipped = 0;
  let invalid = 0;
  const prepared: PreparedFood[] = [];
  for await (const r of records) {
    parsed++;
    const m = map(r as never);
    if (!m.ok) {
      skipped++;
      continue;
    }
    const p = prepareFood(m.food, (f) => f.source === "curated");
    if (!p.ok) {
      invalid++;
      continue;
    }
    prepared.push(p.value);
    if (limit && prepared.length >= limit) break;
  }
  const { winners, duplicates } = dedupePrepared(prepared);
  const flagged = winners.filter((p) => p.quality === "partial" || p.quality === "suspect").length;
  console.log(`${label}: parsed ${parsed} · skipped ${skipped} · invalid ${invalid} · duplicates ${duplicates} · flagged ${flagged} → ${winners.length}`);
  return winners.map((p) => p.food);
}

runCli(async () => {
  const args = parseArgs();
  const outDir = argString(args, "out", SEED_DIR);
  await mkdir(outDir, { recursive: true });
  const usda = await loadUsdaBulk(argString(args, "usda-dir", "data/raw/usda"), ["foundation", "sr_legacy"], { log: console.log });

  const curatedEntries = await loadCuratedFoods();
  const curatedBuilt = buildCuratedFoods(curatedEntries, usda);
  if (curatedBuilt.missing.length) throw new Error(`unresolved curated fdcIds: ${JSON.stringify(curatedBuilt.missing)}`);
  const curated = await prepareAll("curated", curatedBuilt.foods, ((f: NormalizedFood) => ({ ok: true, food: f })) as never);
  const usdaFoods = await prepareAll("usda", usda.values(), mapUsdaRecord as never);
  const offDump = typeof args["off-dump"] === "string" ? args["off-dump"] : null;
  const off = await prepareAll(
    offDump ? `off (dump ${offDump})` : "off (cache)",
    offDump ? readOffJsonl(offDump, { countries: ["en:germany"] }) : readCachedOffPages(argString(args, "off-cache", "data/raw/off")),
    mapOffProduct as never,
    argInt(args, "off-limit") ?? 8000,
  );

  const files: SnapshotFileInfo[] = [];
  const write = async (file: string, source: SnapshotFileInfo["source"], description: string, license: string, foods: NormalizedFood[]) => {
    const info = await writeSnapshotFile(path.join(outDir, file), foods);
    files.push({ file, source, description, license, ...info });
    console.log(`  → ${file}: ${info.count} foods, ${(info.bytes / 1024).toFixed(0)} KiB`);
  };
  await write("foods-curated.de.jsonl.gz", "curated", "Kuratierte deutsche Basis-Lebensmittel (Nährwerte: USDA FDC)", "CC0 1.0 (USDA FoodData Central) / Menta curation", curated);
  await write("foods-usda.jsonl.gz", "usda", "USDA FoodData Central: Foundation Foods 2026-04 + SR Legacy 2018-04", "CC0 1.0 (public domain)", usdaFoods);
  await write("foods-off.de.jsonl.gz", "off", "Open Food Facts: beliebte Produkte in Deutschland (nach Scans)", "ODbL 1.0 (© Open Food Facts contributors)", off);
  await writeSnapshotManifest({ version: 1, builtAt: new Date().toISOString(), files }, outDir);
  const total = files.reduce((a, f) => a + f.bytes, 0);
  console.log(`✓ snapshot: ${files.reduce((a, f) => a + f.count, 0)} foods, ${(total / 1024 / 1024).toFixed(2)} MiB in ${outDir}`);
});
