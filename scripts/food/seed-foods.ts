/**
 * Seeds the public food database from the committed offline snapshot (data/seed).
 *
 *   pnpm db:seed                 # via scripts/db/seed/02-foods.ts
 *   pnpm exec tsx scripts/food/seed-foods.ts [--only=curated,usda,off]
 *
 * Idempotent: upsert on foods (source, source_id), servings synced by label (ids stay stable),
 * fetched_at = snapshot build time, so rows refreshed later from live APIs are never
 * overwritten with older snapshot data.
 */
import "dotenv/config";
import path from "node:path";
import type { Db } from "../../src/server/db/create";
import { formatImportCounts, importFoods } from "../../src/server/food/import/pipeline";
import { readSnapshotFile, readSnapshotManifest, SEED_DIR } from "../../src/server/food/import/snapshot";
import { argString, openDb, parseArgs, runCli } from "./_cli";

export interface SeedFoodsOptions {
  dir?: string;
  /** Limit to these snapshot sources (default: all, in manifest order). */
  only?: readonly ("curated" | "usda" | "off")[];
  log?: (message: string) => void;
}

export async function seedFoods(db: Db, opts: SeedFoodsOptions = {}): Promise<{ inserted: number; updated: number }> {
  const dir = opts.dir ?? path.join(process.cwd(), SEED_DIR);
  const log = opts.log ?? ((m: string) => console.log(m));
  const manifest = await readSnapshotManifest(dir);
  if (!manifest) {
    log(`no food snapshot in ${dir} – run scripts/food/build-seed-snapshot.ts`);
    return { inserted: 0, updated: 0 };
  }
  const fetchedAt = new Date(manifest.builtAt);
  const total = { inserted: 0, updated: 0 };
  for (const f of manifest.files) {
    if (opts.only && !opts.only.includes(f.source)) continue;
    const counts = await importFoods(db, readSnapshotFile(path.join(dir, f.file)), (food) => ({ ok: true, food }), {
      fetchedAt,
      chunkSize: 5000,
      batchSize: 1000,
    });
    total.inserted += counts.inserted;
    total.updated += counts.updated;
    log(formatImportCounts(`  ${f.file}`, counts));
  }
  return total;
}

// Standalone CLI (the seed runner imports this module without running it)
if (/seed-foods\.[cm]?[jt]s$/.test(process.argv[1] ?? "")) {
  runCli(async () => {
    const args = parseArgs();
    const only = typeof args.only === "string" ? (argString(args, "only", "").split(",") as SeedFoodsOptions["only"]) : undefined;
    const t0 = Date.now();
    const r = await seedFoods(await openDb(), { only });
    console.log(`✓ foods seeded: ${r.inserted} inserted, ${r.updated} updated in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
