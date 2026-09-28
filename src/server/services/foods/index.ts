import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { ServiceContext } from "@/server/context";
import type { DbOrTx } from "@/server/db/create";
import { externalLookupCache, favoriteFoods, foods, foodServings, foodUsage } from "@/server/db/schema";
import { searchFoodsReference } from "@/server/db/food-search-sql";
import { getFoodDetails, getFoodDetailsByIds, upsertNormalizedFoods, foodKey } from "@/server/food/persist";
import { OpenFoodFactsProvider } from "@/server/food/providers/open-food-facts";
import type { FoodDetails, NormalizedFood } from "@/server/food/types";
import { barcodeLookupVariants, normalizeBarcode } from "@/domain/food/barcode";
import { normalizeFoodText } from "@/domain/food/normalize";
import { env } from "@/lib/env";
import { notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "foods" });

export type FoodSection = "recent" | "frequent" | "favorite" | "own" | "database" | "external";

/** Compact row for search results and quick picks. */
export interface FoodListItem {
  id: string;
  name: string;
  brandName: string | null;
  source: string;
  section: FoodSection;
  per100: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  basis: "g" | "ml";
  serving: { id: string; label: string; grams: number } | null;
}

export interface FoodForUser extends FoodDetails {
  isFavorite: boolean;
  lastUsage: { servingId: string | null; quantity: number | null; mealId: string | null } | null;
}

// ── Details / favorites / usage ────────────────────────────────────────────

/** Public foods or the user's own foods/recipes. */
export async function getFoodForUser(ctx: ServiceContext, id: string): Promise<FoodForUser> {
  const food = await getFoodDetails(ctx.db, id);
  if (!food || (food.ownerUserId && food.ownerUserId !== ctx.userId)) throw notFound("Lebensmittel");
  const [fav, usage] = await Promise.all([
    ctx.db
      .select({ id: favoriteFoods.foodId })
      .from(favoriteFoods)
      .where(and(eq(favoriteFoods.userId, ctx.userId), eq(favoriteFoods.foodId, id))),
    ctx.db
      .select()
      .from(foodUsage)
      .where(and(eq(foodUsage.userId, ctx.userId), eq(foodUsage.foodId, id))),
  ]);
  const u = usage[0];
  return {
    ...food,
    isFavorite: fav.length > 0,
    lastUsage: u ? { servingId: u.lastServingId, quantity: u.lastQuantity, mealId: u.lastMealId } : null,
  };
}

export async function toggleFavorite(ctx: ServiceContext, foodId: string): Promise<boolean> {
  await getFoodForUser(ctx, foodId);
  const deleted = await ctx.db
    .delete(favoriteFoods)
    .where(and(eq(favoriteFoods.userId, ctx.userId), eq(favoriteFoods.foodId, foodId)))
    .returning();
  if (deleted.length) return false;
  await ctx.db.insert(favoriteFoods).values({ userId: ctx.userId, foodId });
  return true;
}

/** Recent/frequent bookkeeping – call inside the logging transaction. */
export async function recordFoodUsage(
  db: DbOrTx,
  userId: string,
  u: { foodId: string; servingId: string | null; quantity: number; mealId: string },
): Promise<void> {
  await db
    .insert(foodUsage)
    .values({ userId, ...u, useCount: 1, lastServingId: u.servingId, lastQuantity: u.quantity, lastMealId: u.mealId })
    .onConflictDoUpdate({
      target: [foodUsage.userId, foodUsage.foodId],
      set: {
        useCount: sql`${foodUsage.useCount} + 1`,
        lastUsedAt: new Date(),
        lastServingId: u.servingId,
        lastQuantity: u.quantity,
        lastMealId: u.mealId,
      },
    });
  await db.update(foods).set({ popularity: sql`${foods.popularity} + 1` }).where(eq(foods.id, u.foodId));
}

// ── List items ─────────────────────────────────────────────────────────────

async function toListItems(
  db: DbOrTx,
  ids: string[],
  sectionOf: (id: string) => FoodSection,
): Promise<FoodListItem[]> {
  if (!ids.length) return [];
  const [rows, servings] = await Promise.all([
    db.select().from(foods).where(inArray(foods.id, ids)),
    db
      .select()
      .from(foodServings)
      .where(and(inArray(foodServings.foodId, ids), eq(foodServings.isDefault, true))),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const servingBy = new Map(servings.map((s) => [s.foodId, s]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    if (!r || r.isArchived) return [];
    const s = servingBy.get(id);
    return [
      {
        id,
        name: r.name,
        brandName: r.brandName,
        source: r.source,
        section: sectionOf(id),
        per100: { kcal: r.kcal, proteinG: r.proteinG, carbsG: r.carbsG, fatG: r.fatG },
        basis: r.nutrientBasis,
        serving: s ? { id: s.id, label: s.label, grams: s.grams } : null,
      },
    ];
  });
}

/** Empty-query suggestions: recent, frequent, favorites (deduplicated). */
export async function getQuickPicks(ctx: ServiceContext, limit = 8): Promise<FoodListItem[]> {
  const [recent, frequent, favs] = await Promise.all([
    ctx.db
      .select({ id: foodUsage.foodId })
      .from(foodUsage)
      .where(eq(foodUsage.userId, ctx.userId))
      .orderBy(desc(foodUsage.lastUsedAt))
      .limit(limit),
    ctx.db
      .select({ id: foodUsage.foodId })
      .from(foodUsage)
      .where(eq(foodUsage.userId, ctx.userId))
      .orderBy(desc(foodUsage.useCount))
      .limit(limit),
    ctx.db
      .select({ id: favoriteFoods.foodId })
      .from(favoriteFoods)
      .where(eq(favoriteFoods.userId, ctx.userId))
      .orderBy(desc(favoriteFoods.createdAt))
      .limit(limit * 2),
  ]);
  const section = new Map<string, FoodSection>();
  for (const [list, s] of [
    [recent, "recent"],
    [frequent, "frequent"],
    [favs, "favorite"],
  ] as const) {
    for (const { id } of list) if (!section.has(id)) section.set(id, s);
  }
  return toListItems(ctx.db, [...section.keys()], (id) => section.get(id)!);
}

export async function listFavorites(ctx: ServiceContext): Promise<FoodListItem[]> {
  const favs = await ctx.db
    .select({ id: favoriteFoods.foodId })
    .from(favoriteFoods)
    .where(eq(favoriteFoods.userId, ctx.userId))
    .orderBy(desc(favoriteFoods.createdAt));
  return toListItems(ctx.db, favs.map((f) => f.id), () => "favorite");
}

// ── Search ─────────────────────────────────────────────────────────────────

const EXTERNAL_MIN_LOCAL = 8;
const EXTERNAL_TIMEOUT_MS = 2000;
const DAY = 86_400_000;

export interface SearchResult {
  items: FoodListItem[];
  external: "skipped" | "cached" | "fetched" | "timeout" | "error" | "disabled";
}

/**
 * Ranking: exact name match → recent → frequent → favorites → own → database → external.
 * Within a group the reference SQL score (FTS + trigram + popularity) keeps its order.
 */
export async function searchFoods(
  ctx: ServiceContext,
  query: string,
  opts: { limit?: number; includeExternal?: boolean; offProvider?: Pick<OpenFoodFactsProvider, "searchFoods"> } = {},
): Promise<SearchResult> {
  const q = query.trim();
  if (!q) return { items: await getQuickPicks(ctx), external: "skipped" };
  const limit = opts.limit ?? 30;

  if (/^\d{8,14}$/.test(q)) {
    const id = await findLocalBarcode(ctx.db, q);
    return { items: id ? await toListItems(ctx.db, [id], () => "database") : [], external: "skipped" };
  }

  // Query variants: "haehnchen" → "hähnchen" (normalizes to "hahnchen").
  const variants = [...new Set([q, q.replace(/ae/gi, "ä").replace(/oe/gi, "ö").replace(/ue/gi, "ü")])];
  const rowSets = await Promise.all(
    variants.map((v) => searchFoodsReference(ctx.db, { query: v, userId: ctx.userId, limit: limit * 2 })),
  );
  const rows = rowSets
    .flat()
    .sort((a, b) => Number(b.score) - Number(a.score))
    .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i);

  const ids = rows.map((r) => r.id);
  const usage = ids.length
    ? await ctx.db
        .select({ id: foodUsage.foodId, useCount: foodUsage.useCount, lastUsedAt: foodUsage.lastUsedAt })
        .from(foodUsage)
        .where(and(eq(foodUsage.userId, ctx.userId), inArray(foodUsage.foodId, ids)))
    : [];
  const favs = ids.length
    ? await ctx.db
        .select({ id: favoriteFoods.foodId })
        .from(favoriteFoods)
        .where(and(eq(favoriteFoods.userId, ctx.userId), inArray(favoriteFoods.foodId, ids)))
    : [];
  const usageBy = new Map(usage.map((u) => [u.id, u]));
  const favSet = new Set(favs.map((f) => f.id));
  const norm = normalizeFoodText(q);
  const weekAgo = Date.now() - 7 * DAY;

  const sectionOf = (r: (typeof rows)[number]): FoodSection => {
    const u = usageBy.get(r.id);
    if (u && u.lastUsedAt.getTime() > weekAgo) return "recent";
    if (u && u.useCount >= 3) return "frequent";
    if (favSet.has(r.id)) return "favorite";
    if (r.owner_user_id) return "own";
    return "database";
  };
  const groupRank: Record<FoodSection, number> = { recent: 1, frequent: 2, favorite: 3, own: 4, database: 5, external: 6 };
  // German curated rows beat their English USDA twins; suspect data sinks.
  const penalty = (r: (typeof rows)[number]) =>
    (r.source === "usda" ? 0.5 : 0) + (r.data_quality === "suspect" ? 1 : 0);
  // Tier 0: own history (recent/frequent/favorite) whose name starts with the query – re-logging
  // must be instant. Tier 1: up to 3 exact name matches. Tier 2: everything else by group/score.
  let exactSlots = 3;
  const ranked = rows
    .map((r, i) => {
      const name = normalizeFoodText(r.name);
      const group = groupRank[sectionOf(r)];
      const tier = group <= 3 && name.startsWith(norm) ? 0 : name === norm && exactSlots-- > 0 ? 1 : 2;
      return { r, i, tier, group };
    })
    .sort((a, b) => a.tier - b.tier || a.group - b.group || penalty(a.r) - penalty(b.r) || a.i - b.i)
    .slice(0, limit);
  const sections = new Map(ranked.map(({ r }) => [r.id, sectionOf(r)]));
  let items = await toListItems(ctx.db, ranked.map(({ r }) => r.id), (id) => sections.get(id)!);

  let external: SearchResult["external"] = "skipped";
  if (opts.includeExternal !== false && items.length < EXTERNAL_MIN_LOCAL) {
    const res = await searchExternal(ctx.db, q, opts.offProvider);
    external = res.status;
    const known = new Set(items.map((i) => i.id));
    const extra = await toListItems(ctx.db, res.ids.filter((id) => !known.has(id)), () => "external");
    items = [...items, ...extra].slice(0, limit);
  }
  return { items, external };
}

async function searchExternal(
  db: DbOrTx,
  q: string,
  provider?: Pick<OpenFoodFactsProvider, "searchFoods">,
): Promise<{ ids: string[]; status: SearchResult["external"] }> {
  if (!env.FOOD_EXTERNAL_PROVIDERS_ENABLED) return { ids: [], status: "disabled" };
  const key = `off:search:de:${normalizeFoodText(q)}`;
  const [cached] = await db.select().from(externalLookupCache).where(eq(externalLookupCache.key, key));
  if (cached && cached.expiresAt > new Date()) return { ids: cached.foodIds ?? [], status: "cached" };

  const off = provider ?? new OpenFoodFactsProvider();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), EXTERNAL_TIMEOUT_MS);
  try {
    const found = await off.searchFoods(q, { limit: 20, language: "de", country: "de", signal: ac.signal });
    const ids = await persistExternal(db, found);
    await writeCache(db, key, "search", ids, ids.length ? 7 * DAY : DAY);
    return { ids, status: "fetched" };
  } catch (err) {
    const aborted = ac.signal.aborted;
    log.warn("external search failed", { q, aborted, err: String(err) });
    return { ids: [], status: aborted ? "timeout" : "error" };
  } finally {
    clearTimeout(timer);
  }
}

async function persistExternal(db: DbOrTx, found: NormalizedFood[]): Promise<string[]> {
  if (!found.length) return [];
  const map = await upsertNormalizedFoods(db, found);
  return [...new Set(found.map((f) => map.get(foodKey(f))).filter((id): id is string => !!id))];
}

async function writeCache(db: DbOrTx, key: string, kind: string, ids: string[], ttlMs: number) {
  const values = {
    key,
    provider: "off",
    kind,
    found: ids.length > 0,
    foodIds: ids,
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + ttlMs),
  };
  await db.insert(externalLookupCache).values(values).onConflictDoUpdate({ target: externalLookupCache.key, set: values });
}

// ── Barcode ────────────────────────────────────────────────────────────────

async function findLocalBarcode(db: DbOrTx, code: string): Promise<string | null> {
  const variants = barcodeLookupVariants(code);
  if (!variants.length) return null;
  const [row] = await db
    .select({ id: foods.id })
    .from(foods)
    .where(and(inArray(foods.barcode, variants), eq(foods.isArchived, false)))
    .orderBy(desc(foods.popularity))
    .limit(1);
  return row?.id ?? null;
}

/** Barcode → food id: local DB, then cached/live Open Food Facts lookup. Null = unknown product. */
export async function lookupBarcode(
  ctx: ServiceContext,
  input: string,
  provider?: Pick<OpenFoodFactsProvider, "getFoodByBarcode">,
): Promise<{ foodId: string | null; source: "local" | "cached" | "fetched" | "none" }> {
  const code = normalizeBarcode(input) ?? input.replace(/\D/g, "");
  const local = await findLocalBarcode(ctx.db, code);
  if (local) return { foodId: local, source: "local" };
  if (!env.FOOD_EXTERNAL_PROVIDERS_ENABLED) return { foodId: null, source: "none" };

  const key = `off:barcode:${code}`;
  const [cached] = await ctx.db.select().from(externalLookupCache).where(eq(externalLookupCache.key, key));
  if (cached && cached.expiresAt > new Date()) return { foodId: cached.foodIds?.[0] ?? null, source: "cached" };

  try {
    const food = await (provider ?? new OpenFoodFactsProvider()).getFoodByBarcode(code);
    const ids = food ? await persistExternal(ctx.db, [food]) : [];
    await writeCache(ctx.db, key, "barcode", ids, ids.length ? 30 * DAY : DAY);
    return { foodId: ids[0] ?? null, source: ids.length ? "fetched" : "none" };
  } catch (err) {
    log.warn("barcode lookup failed", { code, err: String(err) });
    return { foodId: null, source: "none" };
  }
}

export { getFoodDetailsByIds };
