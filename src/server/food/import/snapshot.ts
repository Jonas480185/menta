/**
 * Offline seed snapshot (data/seed/*.jsonl.gz): prepared NormalizedFood records, one JSON
 * object per line, gzip-compressed, committed to the repo so `pnpm db:seed` works offline
 * and deterministically (no API keys, no downloads).
 *
 * Files are written sorted by key with gzip mtime 0 → byte-identical rebuilds for identical
 * input (clean diffs).
 */
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createInterface } from "node:readline";
import { createGunzip, gzipSync } from "node:zlib";
import { z } from "zod";
import type { NormalizedFood } from "@/server/food/types";
import { foodKey } from "@/server/food/normalize/prepare";

export const SEED_DIR = "data/seed";
export const SEED_MANIFEST = "manifest.json";

export const snapshotFileSchema = z.object({
  file: z.string(),
  source: z.enum(["curated", "usda", "off"]),
  description: z.string(),
  license: z.string(),
  count: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string(),
});
export type SnapshotFileInfo = z.infer<typeof snapshotFileSchema>;

export const snapshotManifestSchema = z.object({
  version: z.literal(1),
  /** ISO timestamp; used as foods.fetched_at when seeding (newer live data is never overwritten). */
  builtAt: z.string(),
  /** Import order matters: curated first (DE names), then USDA, then OFF. */
  files: z.array(snapshotFileSchema),
});
export type SnapshotManifest = z.infer<typeof snapshotManifestSchema>;

/** Serializes foods as sorted, gzipped JSONL. Returns size and checksum. */
export async function writeSnapshotFile(
  file: string,
  foods: readonly NormalizedFood[],
): Promise<{ count: number; bytes: number; sha256: string }> {
  const sorted = [...foods].sort((a, b) => (foodKey(a) < foodKey(b) ? -1 : foodKey(a) > foodKey(b) ? 1 : 0));
  const body = sorted.map((f) => JSON.stringify(compactFood(f))).join("\n") + (sorted.length ? "\n" : "");
  const gz = gzipSync(body, { level: 9 });
  await writeFile(file, gz);
  return { count: sorted.length, bytes: gz.length, sha256: createHash("sha256").update(gz).digest("hex") };
}

/** Drops null/undefined/empty fields to keep the snapshot small (restored by `expandFood`). */
function compactFood(f: NormalizedFood): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0 && k !== "servings") continue;
    if (k === "nutrients") {
      out[k] = Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== null && x !== undefined));
      continue;
    }
    if (k === "servings") {
      out[k] = (v as NormalizedFood["servings"]).map((s) => (s.isDefault ? s : { label: s.label, amount: s.amount, unit: s.unit, grams: s.grams }));
      continue;
    }
    out[k] = v;
  }
  return out;
}

const snapshotFoodSchema = z.looseObject({
  source: z.enum(["curated", "usda", "off"]),
  sourceId: z.string(),
  name: z.string(),
  nutrientBasis: z.enum(["g", "ml"]),
  nutrients: z.looseObject({ kcal: z.number(), proteinG: z.number(), carbsG: z.number(), fatG: z.number() }),
  servings: z.array(z.looseObject({ label: z.string(), amount: z.number(), unit: z.string(), grams: z.number() })),
});

function expandFood(raw: unknown): NormalizedFood {
  const f = snapshotFoodSchema.parse(raw) as unknown as Partial<NormalizedFood> & Pick<NormalizedFood, "source" | "name">;
  return {
    source: f.source,
    sourceId: f.sourceId ?? null,
    name: f.name,
    brandName: f.brandName ?? null,
    barcode: f.barcode ?? null,
    category: f.category ?? null,
    language: f.language ?? null,
    countries: f.countries ?? null,
    imageUrl: f.imageUrl ?? null,
    nutrientBasis: f.nutrientBasis ?? "g",
    densityGPerMl: f.densityGPerMl ?? null,
    nutrients: f.nutrients!,
    servings: f.servings ?? [],
    popularity: f.popularity ?? 0,
    qualityFlags: f.qualityFlags ?? [],
  };
}

/** Streams foods from a snapshot file (constant memory). */
export async function* readSnapshotFile(file: string): AsyncGenerator<NormalizedFood> {
  const raw = createReadStream(file);
  const rl = createInterface({ input: raw.pipe(createGunzip()), crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (line.trim()) yield expandFood(JSON.parse(line));
    }
  } finally {
    rl.close();
    raw.destroy();
  }
}

export async function readSnapshotManifest(dir = SEED_DIR): Promise<SnapshotManifest | null> {
  try {
    return snapshotManifestSchema.parse(JSON.parse(await readFile(path.join(dir, SEED_MANIFEST), "utf8")));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeSnapshotManifest(manifest: SnapshotManifest, dir = SEED_DIR): Promise<void> {
  await writeFile(path.join(dir, SEED_MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
}
