/**
 * Shared import pipeline for CLIs, seed and snapshot builder:
 *
 *   source records → map (provider normalizer) → prepare (validate/flag) → dedupe → upsert
 *
 * Streams in chunks so arbitrarily large inputs (full OFF dump) run in constant memory.
 * Every stage is counted so each run prints a reproducible report.
 */
import type { DbOrTx } from "@/server/db/create";
import type { NormalizedFood } from "@/server/food/types";
import { upsertNormalizedFoodsDetailed, type UpsertStats } from "@/server/food/persist";
import { dedupePrepared, prepareFood, type PreparedFood } from "@/server/food/normalize/prepare";

export type MapOutcome = { ok: true; food: NormalizedFood } | { ok: false; reason: string };

export interface ImportCounts {
  /** Raw records read from the source. */
  parsed: number;
  /** Records the normalizer skipped (no name, no nutrition data, bad barcode …) by reason. */
  skipped: Record<string, number>;
  /** Rejected by validation (hard errors). */
  invalid: number;
  /** Validation errors by code. */
  errors: Record<string, number>;
  /** Stored, but partial/suspect quality. */
  flagged: number;
  duplicates: number;
  inserted: number;
  updated: number;
  archived: number;
  skippedNewer: number;
  ms: number;
}

export const emptyImportCounts = (): ImportCounts => ({
  parsed: 0,
  skipped: {},
  invalid: 0,
  errors: {},
  flagged: 0,
  duplicates: 0,
  inserted: 0,
  updated: 0,
  archived: 0,
  skippedNewer: 0,
  ms: 0,
});

export interface ImportOptions {
  /** Records per upsert call (each split into transactions of `batchSize`). Default 2000. */
  chunkSize?: number;
  batchSize?: number;
  fetchedAt?: Date;
  /** Clean records from these sources become "verified" (default: curated only). */
  trusted?: (food: NormalizedFood) => boolean;
  /** Validate and dedupe only, write nothing (db may be null). */
  dryRun?: boolean;
  onProgress?: (counts: ImportCounts) => void;
}

const bump = (rec: Record<string, number>, key: string, by = 1) => {
  rec[key] = (rec[key] ?? 0) + by;
};

function addStats(counts: ImportCounts, s: UpsertStats, prev: UpsertStats | null) {
  const d = (k: keyof UpsertStats) => s[k] - (prev?.[k] ?? 0);
  counts.invalid += d("invalid");
  counts.flagged += d("flagged");
  counts.duplicates += d("duplicates");
  counts.inserted += d("inserted");
  counts.updated += d("updated");
  counts.archived += d("archived");
  counts.skippedNewer += d("skippedNewer");
}

/** Maps, validates, dedupes and upserts a stream of source records. */
export async function importFoods<T>(
  db: DbOrTx | null,
  records: AsyncIterable<T> | Iterable<T>,
  map: (record: T) => MapOutcome,
  opts: ImportOptions = {},
): Promise<ImportCounts> {
  const t0 = Date.now();
  const counts = emptyImportCounts();
  const chunkSize = Math.max(1, opts.chunkSize ?? 2000);
  const trusted = opts.trusted ?? ((f: NormalizedFood) => f.source === "curated");
  const seenKeys = new Set<string>();
  let chunk: NormalizedFood[] = [];

  const flush = async () => {
    if (!chunk.length) return;
    const items = chunk;
    chunk = [];
    if (opts.dryRun || !db) {
      const prepared: PreparedFood[] = [];
      for (const f of items) {
        const r = prepareFood(f, trusted);
        if (r.ok) prepared.push(r.value);
        else {
          counts.invalid++;
          for (const e of r.errors) bump(counts.errors, e.code);
        }
      }
      const deduped = dedupePrepared(prepared);
      counts.duplicates += deduped.duplicates;
      for (const p of deduped.winners) {
        if (p.quality === "partial" || p.quality === "suspect") counts.flagged++;
        // cross-chunk key duplicates (would be an update in a real run)
        if (seenKeys.has(p.key)) counts.duplicates++;
        else {
          seenKeys.add(p.key);
          counts.inserted++;
        }
      }
    } else {
      const report = await upsertNormalizedFoodsDetailed(db, items, {
        batchSize: opts.batchSize,
        fetchedAt: opts.fetchedAt,
        trusted: opts.trusted,
      });
      addStats(counts, report.stats, null);
      for (const [code, n] of Object.entries(report.errorCounts)) bump(counts.errors, code, n);
    }
    counts.ms = Date.now() - t0;
    opts.onProgress?.(counts);
  };

  for await (const rec of records) {
    counts.parsed++;
    const m = map(rec);
    if (!m.ok) {
      bump(counts.skipped, m.reason);
      continue;
    }
    chunk.push(m.food);
    if (chunk.length >= chunkSize) await flush();
  }
  await flush();
  counts.ms = Date.now() - t0;
  return counts;
}

/** One-line human summary, e.g. for CLI output and seed logs. */
export function formatImportCounts(label: string, c: ImportCounts): string {
  const skipped = Object.values(c.skipped).reduce((a, b) => a + b, 0);
  const detail = (rec: Record<string, number>) =>
    Object.entries(rec)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
  return [
    `${label}: parsed ${c.parsed} · skipped ${skipped}${skipped ? ` (${detail(c.skipped)})` : ""}`,
    `  invalid ${c.invalid}${c.invalid ? ` (${detail(c.errors)})` : ""} · flagged ${c.flagged} · duplicates ${c.duplicates}`,
    `  inserted ${c.inserted} · updated ${c.updated} · archived ${c.archived} · kept-newer ${c.skippedNewer} · ${(c.ms / 1000).toFixed(1)} s`,
  ].join("\n");
}
