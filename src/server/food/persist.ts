/**
 * Persistence of normalized foods (public food database: OFF, USDA, curated).
 *
 * Pipeline per batch: canonicalize → sanitize servings → validate → dedupe (key + barcode,
 * in-batch and against the DB) → upsert brands → upsert foods → sync servings.
 *
 * - Identity: (source, source_id) is unique (partial unique index).
 * - Barcode dedupe across sources: the richer/better record stays active; the other one is
 *   archived (`is_archived = true`, never deleted – diary entries/favorites may reference it).
 * - Servings are synced by label/unit+grams so re-imports keep serving ids stable
 *   (food_usage.last_serving_id / meal_entries.serving_id stay valid).
 * - `popularity` never decreases on re-import (usage-based popularity is preserved).
 *
 * No `server-only` import: used by tsx import/seed scripts as well.
 */
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/create";
import { foodBrands, foods, foodServings } from "@/server/db/schema";
import type { FoodDetails, NormalizedFood, NormalizedServing } from "@/server/food/types";
import { normalizeFoodText } from "@/domain/food/normalize";
import { normalizeBarcode } from "@/domain/food/barcode";
import { isValidServingGrams } from "@/domain/food/units";
import { validateNormalizedFood, type DataQuality, type ValidationIssue } from "@/domain/food/validation";
import { finalizeServings } from "@/server/food/normalize/common";

/** Stable key of a normalized food: "off:4014400400007", "usda:173944", "curated:apfel". */
export function foodKey(food: Pick<NormalizedFood, "source" | "sourceId">): string {
  return `${food.source}:${food.sourceId ?? ""}`;
}

export interface UpsertOptions {
  /** Foods per transaction (default 500). */
  batchSize?: number;
  /** Clean records from these sources become "verified" (default: curated only). */
  trusted?: (food: NormalizedFood) => boolean;
  fetchedAt?: Date;
  /** Cross-source barcode dedupe against the DB (default true). */
  dedupeByBarcode?: boolean;
  onBatch?: (stats: UpsertStats) => void;
}

export interface UpsertStats {
  received: number;
  invalid: number;
  /** Valid records that carry at least one quality flag that lowers quality (partial/suspect). */
  flagged: number;
  duplicates: number;
  inserted: number;
  updated: number;
  archived: number;
}

export interface UpsertReport {
  /** foodKey → foods.id (duplicates map to the surviving row). */
  ids: Map<string, string>;
  stats: UpsertStats;
  /** First 200 rejected records with reasons (for import logs). */
  rejected: { key: string; name: string; errors: ValidationIssue[] }[];
  /** Counts per validation error code. */
  errorCounts: Record<string, number>;
}

interface Prepared {
  key: string;
  food: NormalizedFood;
  barcode: string | null;
  quality: DataQuality;
  flags: string[];
  richness: number;
}

const QUALITY_RANK: Record<DataQuality, number> = { verified: 4, complete: 3, partial: 1, suspect: 0 };

/** Higher = better record for the same product (used for barcode dedupe). */
export function foodRichness(input: {
  quality: DataQuality;
  nutrients: Record<string, unknown>;
  servingCount: number;
  language: string | null;
  brandName: string | null;
  imageUrl: string | null;
}): number {
  const nutrientFields = Object.entries(input.nutrients).filter(
    ([k, v]) => k !== "micronutrients" && typeof v === "number",
  ).length;
  const micros = input.nutrients.micronutrients ? Object.keys(input.nutrients.micronutrients as object).length : 0;
  return (
    QUALITY_RANK[input.quality] * 100 +
    (input.language === "de" ? 20 : 0) +
    nutrientFields * 2 +
    Math.min(micros, 10) +
    Math.min(input.servingCount, 5) +
    (input.brandName ? 2 : 0) +
    (input.imageUrl ? 2 : 0)
  );
}

function sanitizeServings(food: NormalizedFood): NormalizedServing[] {
  const valid = food.servings.filter(
    (s) => isValidServingGrams(s.grams) && s.amount > 0 && Number.isFinite(s.amount) && s.label?.trim(),
  );
  return finalizeServings(
    valid.map((s) => ({ ...s, label: s.label.trim().slice(0, 120) })),
    food.nutrientBasis,
  );
}

function prepare(
  food: NormalizedFood,
  trusted: (f: NormalizedFood) => boolean,
): { ok: true; value: Prepared } | { ok: false; errors: ValidationIssue[] } {
  if (!food.sourceId) {
    return { ok: false, errors: [{ code: "missing_source_id", field: "sourceId", message: "sourceId fehlt." }] };
  }
  const barcode = food.barcode ? normalizeBarcode(food.barcode, { requireValidChecksum: false }) : null;
  const cleaned: NormalizedFood = {
    ...food,
    name: food.name?.replace(/\s+/g, " ").trim() ?? "",
    brandName: food.brandName?.replace(/\s+/g, " ").trim() || null,
    barcode,
    servings: sanitizeServings(food),
  };
  const v = validateNormalizedFood(cleaned, { trusted: trusted(food) });
  if (!v.valid) return { ok: false, errors: v.errors };
  const value: NormalizedFood = { ...cleaned, nutrients: v.nutrients, qualityFlags: v.flags };
  return {
    ok: true,
    value: {
      key: foodKey(food),
      food: value,
      barcode,
      quality: v.quality,
      flags: v.flags,
      richness: foodRichness({
        quality: v.quality,
        nutrients: v.nutrients as unknown as Record<string, unknown>,
        servingCount: value.servings.length,
        language: value.language,
        brandName: value.brandName,
        imageUrl: value.imageUrl,
      }),
    },
  };
}

const emptyStats = (): UpsertStats => ({
  received: 0,
  invalid: 0,
  flagged: 0,
  duplicates: 0,
  inserted: 0,
  updated: 0,
  archived: 0,
});

/** Upserts foods and returns foodKey → id. See `upsertNormalizedFoodsDetailed` for stats. */
export async function upsertNormalizedFoods(
  db: DbOrTx,
  items: readonly NormalizedFood[],
  opts: UpsertOptions = {},
): Promise<Map<string, string>> {
  return (await upsertNormalizedFoodsDetailed(db, items, opts)).ids;
}

export async function upsertNormalizedFoodsDetailed(
  db: DbOrTx,
  items: readonly NormalizedFood[],
  opts: UpsertOptions = {},
): Promise<UpsertReport> {
  const report: UpsertReport = { ids: new Map(), stats: emptyStats(), rejected: [], errorCounts: {} };
  const batchSize = Math.max(1, opts.batchSize ?? 500);
  for (let i = 0; i < items.length; i += batchSize) {
    await upsertBatch(db, items.slice(i, i + batchSize), opts, report);
    opts.onBatch?.(report.stats);
  }
  return report;
}

async function upsertBatch(db: DbOrTx, batch: readonly NormalizedFood[], opts: UpsertOptions, report: UpsertReport) {
  const { stats, ids } = report;
  const trusted = opts.trusted ?? ((f: NormalizedFood) => f.source === "curated");
  stats.received += batch.length;

  // 1) validate + in-batch dedupe (by key, then by barcode)
  const byKey = new Map<string, Prepared>();
  const aliases = new Map<string, string>(); // dropped key → winning key
  for (const food of batch) {
    const r = prepare(food, trusted);
    if (!r.ok) {
      stats.invalid++;
      for (const e of r.errors) report.errorCounts[e.code] = (report.errorCounts[e.code] ?? 0) + 1;
      if (report.rejected.length < 200) report.rejected.push({ key: foodKey(food), name: food.name, errors: r.errors });
      continue;
    }
    const p = r.value;
    const existing = byKey.get(p.key);
    if (existing) {
      stats.duplicates++;
      if (p.richness > existing.richness) byKey.set(p.key, p);
      continue;
    }
    byKey.set(p.key, p);
  }
  const byBarcode = new Map<string, Prepared>();
  for (const p of [...byKey.values()]) {
    if (!p.barcode) continue;
    const other = byBarcode.get(p.barcode);
    if (!other) {
      byBarcode.set(p.barcode, p);
      continue;
    }
    stats.duplicates++;
    const [winner, loser] = p.richness > other.richness ? [p, other] : [other, p];
    byBarcode.set(p.barcode, winner);
    byKey.delete(loser.key);
    aliases.set(loser.key, winner.key);
  }

  await db.transaction(async (tx) => {
    // 2) barcode dedupe against existing active rows of other identities
    const toArchive = new Set<string>();
    const barcodes = [...byBarcode.keys()];
    if ((opts.dedupeByBarcode ?? true) && barcodes.length) {
      const rows = await tx
        .select({
          id: foods.id,
          source: foods.source,
          sourceId: foods.sourceId,
          barcode: foods.barcode,
          dataQuality: foods.dataQuality,
          language: foods.language,
          brandName: foods.brandName,
          imageUrl: foods.imageUrl,
          kcal: foods.kcal,
          proteinG: foods.proteinG,
          carbsG: foods.carbsG,
          fatG: foods.fatG,
          fiberG: foods.fiberG,
          sugarG: foods.sugarG,
          saturatedFatG: foods.saturatedFatG,
          saltG: foods.saltG,
          sodiumMg: foods.sodiumMg,
          potassiumMg: foods.potassiumMg,
          calciumMg: foods.calciumMg,
          ironMg: foods.ironMg,
          micronutrients: foods.micronutrients,
          servingCount: sql<number>`(select count(*)::int from ${foodServings} where ${foodServings.foodId} = ${foods.id})`,
        })
        .from(foods)
        .where(
          and(
            inArray(foods.barcode, barcodes),
            isNull(foods.ownerUserId),
            eq(foods.visibility, "public"),
            eq(foods.isArchived, false),
          ),
        );
      for (const row of rows) {
        const p = row.barcode ? byBarcode.get(row.barcode) : undefined;
        if (!p || !byKey.has(p.key)) continue;
        if (row.source === p.food.source && row.sourceId === p.food.sourceId) continue;
        const { id, source, sourceId, barcode, dataQuality, language, brandName, imageUrl, servingCount, ...nutrients } = row;
        void source;
        void sourceId;
        void barcode;
        const existingRichness = foodRichness({ quality: dataQuality, nutrients, servingCount, language, brandName, imageUrl });
        stats.duplicates++;
        if (p.richness > existingRichness) {
          toArchive.add(id);
        } else {
          byKey.delete(p.key);
          ids.set(p.key, id);
        }
      }
    }

    const winners = [...byKey.values()];
    for (const p of winners) {
      if (p.quality === "partial" || p.quality === "suspect") stats.flagged++;
    }
    if (toArchive.size) {
      await tx
        .update(foods)
        .set({ isArchived: true })
        .where(inArray(foods.id, [...toArchive]));
      stats.archived += toArchive.size;
    }
    if (!winners.length) return;

    // 3) brands
    const brandNames = new Map<string, string>();
    for (const p of winners) {
      if (p.food.brandName) {
        const n = normalizeFoodText(p.food.brandName);
        if (n && !brandNames.has(n)) brandNames.set(n, p.food.brandName);
      }
    }
    const brandIds = new Map<string, string>();
    if (brandNames.size) {
      const values = [...brandNames].map(([nameNormalized, name]) => ({ name, nameNormalized }));
      await tx.insert(foodBrands).values(values).onConflictDoNothing({ target: foodBrands.nameNormalized });
      const rows = await tx
        .select({ id: foodBrands.id, nameNormalized: foodBrands.nameNormalized })
        .from(foodBrands)
        .where(inArray(foodBrands.nameNormalized, [...brandNames.keys()]));
      for (const r of rows) brandIds.set(r.nameNormalized, r.id);
    }

    // 4) foods
    const fetchedAt = opts.fetchedAt ?? new Date();
    const values = winners.map((p) => {
      const f = p.food;
      const n = f.nutrients;
      const brandNormalized = f.brandName ? normalizeFoodText(f.brandName) : null;
      return {
        source: f.source,
        sourceId: f.sourceId,
        visibility: "public" as const,
        name: f.name,
        nameNormalized: normalizeFoodText(f.name),
        brandId: brandNormalized ? (brandIds.get(brandNormalized) ?? null) : null,
        brandName: f.brandName,
        brandNormalized,
        barcode: p.barcode,
        category: f.category,
        language: f.language,
        countries: f.countries,
        imageUrl: f.imageUrl,
        nutrientBasis: f.nutrientBasis,
        densityGPerMl: f.densityGPerMl,
        kcal: n.kcal,
        proteinG: n.proteinG,
        carbsG: n.carbsG,
        fatG: n.fatG,
        fiberG: n.fiberG ?? null,
        sugarG: n.sugarG ?? null,
        saturatedFatG: n.saturatedFatG ?? null,
        saltG: n.saltG ?? null,
        sodiumMg: n.sodiumMg ?? null,
        potassiumMg: n.potassiumMg ?? null,
        calciumMg: n.calciumMg ?? null,
        ironMg: n.ironMg ?? null,
        micronutrients: n.micronutrients ?? null,
        dataQuality: p.quality,
        qualityFlags: p.flags.length ? p.flags : null,
        popularity: Math.max(0, Math.round(f.popularity ?? 0)),
        isArchived: false,
        fetchedAt,
      };
    });
    const ex = (col: string) => sql.raw(`excluded.${col}`);
    const upserted = await tx
      .insert(foods)
      .values(values)
      .onConflictDoUpdate({
        target: [foods.source, foods.sourceId],
        targetWhere: sql`${foods.sourceId} is not null`,
        set: {
          name: ex("name"),
          nameNormalized: ex("name_normalized"),
          brandId: ex("brand_id"),
          brandName: ex("brand_name"),
          brandNormalized: ex("brand_normalized"),
          barcode: ex("barcode"),
          category: ex("category"),
          language: ex("language"),
          countries: ex("countries"),
          imageUrl: ex("image_url"),
          nutrientBasis: ex("nutrient_basis"),
          densityGPerMl: ex("density_g_per_ml"),
          kcal: ex("kcal"),
          proteinG: ex("protein_g"),
          carbsG: ex("carbs_g"),
          fatG: ex("fat_g"),
          fiberG: ex("fiber_g"),
          sugarG: ex("sugar_g"),
          saturatedFatG: ex("saturated_fat_g"),
          saltG: ex("salt_g"),
          sodiumMg: ex("sodium_mg"),
          potassiumMg: ex("potassium_mg"),
          calciumMg: ex("calcium_mg"),
          ironMg: ex("iron_mg"),
          micronutrients: ex("micronutrients"),
          dataQuality: ex("data_quality"),
          qualityFlags: ex("quality_flags"),
          popularity: sql`greatest(${foods.popularity}, excluded.popularity)`,
          isArchived: false,
          fetchedAt: ex("fetched_at"),
          updatedAt: sql`now()`,
        },
      })
      .returning({
        id: foods.id,
        source: foods.source,
        sourceId: foods.sourceId,
        inserted: sql<boolean>`(xmax = 0)`,
      });

    const idByKey = new Map<string, string>();
    for (const r of upserted) {
      idByKey.set(`${r.source}:${r.sourceId}`, r.id);
      if (r.inserted) stats.inserted++;
      else stats.updated++;
    }
    for (const [k, v] of idByKey) ids.set(k, v);

    // 5) servings
    await syncServings(
      tx,
      winners.map((p) => ({ foodId: idByKey.get(p.key)!, servings: p.food.servings })).filter((x) => x.foodId),
    );
  });

  for (const [loser, winner] of aliases) {
    const id = ids.get(winner);
    if (id) ids.set(loser, id);
  }
}

type ServingRow = typeof foodServings.$inferSelect;

async function syncServings(tx: DbOrTx, entries: { foodId: string; servings: NormalizedServing[] }[]) {
  if (!entries.length) return;
  const existing = await tx
    .select()
    .from(foodServings)
    .where(
      inArray(
        foodServings.foodId,
        entries.map((e) => e.foodId),
      ),
    );
  const byFood = new Map<string, ServingRow[]>();
  for (const s of existing) {
    const list = byFood.get(s.foodId) ?? [];
    list.push(s);
    byFood.set(s.foodId, list);
  }

  const inserts: (typeof foodServings.$inferInsert)[] = [];
  const deletes: string[] = [];
  const updates: { id: string; set: Partial<typeof foodServings.$inferInsert> }[] = [];
  for (const { foodId, servings } of entries) {
    const pool = [...(byFood.get(foodId) ?? [])];
    servings.forEach((s, sortOrder) => {
      const isDefault = !!s.isDefault;
      const idx = pool.findIndex(
        (e) =>
          e.label.toLowerCase() === s.label.toLowerCase() ||
          (e.unit === s.unit && Math.abs(e.grams - s.grams) < 0.01 && Math.abs(e.amount - s.amount) < 0.001),
      );
      if (idx >= 0) {
        const e = pool.splice(idx, 1)[0];
        if (
          e.label !== s.label ||
          e.amount !== s.amount ||
          e.unit !== s.unit ||
          e.grams !== s.grams ||
          e.isDefault !== isDefault ||
          e.sortOrder !== sortOrder
        ) {
          updates.push({ id: e.id, set: { label: s.label, amount: s.amount, unit: s.unit, grams: s.grams, isDefault, sortOrder } });
        }
      } else {
        inserts.push({ foodId, label: s.label, amount: s.amount, unit: s.unit, grams: s.grams, isDefault, sortOrder });
      }
    });
    deletes.push(...pool.map((e) => e.id));
  }

  if (deletes.length) await tx.delete(foodServings).where(inArray(foodServings.id, deletes));
  for (const u of updates) await tx.update(foodServings).set(u.set).where(eq(foodServings.id, u.id));
  for (let i = 0; i < inserts.length; i += 2000) {
    await tx.insert(foodServings).values(inserts.slice(i, i + 2000));
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────

type FoodRow = typeof foods.$inferSelect;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);

/** Maps a foods row + its servings to the FoodDetails contract. */
export function toFoodDetails(row: FoodRow, servings: readonly ServingRow[]): FoodDetails {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    source: row.source,
    sourceId: row.sourceId,
    name: row.name,
    brandName: row.brandName,
    barcode: row.barcode,
    category: row.category,
    language: row.language,
    countries: row.countries,
    imageUrl: row.imageUrl,
    nutrientBasis: row.nutrientBasis,
    densityGPerMl: row.densityGPerMl,
    nutrients: {
      kcal: row.kcal,
      proteinG: row.proteinG,
      carbsG: row.carbsG,
      fatG: row.fatG,
      fiberG: row.fiberG,
      sugarG: row.sugarG,
      saturatedFatG: row.saturatedFatG,
      saltG: row.saltG,
      sodiumMg: row.sodiumMg,
      potassiumMg: row.potassiumMg,
      calciumMg: row.calciumMg,
      ironMg: row.ironMg,
      micronutrients: row.micronutrients ?? null,
    },
    popularity: row.popularity,
    qualityFlags: row.qualityFlags ?? [],
    dataQuality: row.dataQuality,
    servings: [...servings]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.grams - b.grams)
      .map((s) => ({ id: s.id, label: s.label, amount: s.amount, unit: s.unit, grams: s.grams, isDefault: s.isDefault })),
  };
}

/** Loads several foods with servings (order of `ids` is preserved; unknown ids are skipped). */
export async function getFoodDetailsByIds(db: DbOrTx, ids: readonly string[]): Promise<FoodDetails[]> {
  const valid = [...new Set(ids.filter(isUuid))];
  if (!valid.length) return [];
  const rows = await db.select().from(foods).where(inArray(foods.id, valid));
  const servings = await db
    .select()
    .from(foodServings)
    .where(inArray(foodServings.foodId, valid))
    .orderBy(asc(foodServings.sortOrder));
  const byFood = new Map<string, ServingRow[]>();
  for (const s of servings) {
    const list = byFood.get(s.foodId) ?? [];
    list.push(s);
    byFood.set(s.foodId, list);
  }
  const byId = new Map(rows.map((r) => [r.id, toFoodDetails(r, byFood.get(r.id) ?? [])]));
  return valid.map((id) => byId.get(id)).filter((f): f is FoodDetails => !!f);
}

/** Single food incl. servings, or null. Does not check visibility – callers scope access. */
export async function getFoodDetails(db: DbOrTx, id: string): Promise<FoodDetails | null> {
  return (await getFoodDetailsByIds(db, [id]))[0] ?? null;
}
