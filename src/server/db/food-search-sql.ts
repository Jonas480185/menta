import { sql, type SQL } from "drizzle-orm";
import { normalizeFoodText } from "@/domain/food/normalize";
import type { DbOrTx } from "./create";
import { queryRows } from "./sql";

/**
 * REFERENCE food search SQL. Documented in
 * docs/architecture/database.md §6 and benchmarked by scripts/db/bench-search.ts.
 *
 * Food Search builds ranking/orchestration on top of this: tune the weights,
 * add recents/favorites boosts, but keep the WHERE clauses index-shaped:
 *
 *   - public foods: `visibility = 'public' AND NOT is_archived` must stay LITERAL SQL so the
 *     planner can use the partial GIN/btree indexes (see PUBLIC_FOODS_PREDICATE in schema).
 *   - own foods / recipes: `owner_user_id = $user` → foods_owner_idx; a user has at most a few
 *     thousand rows, so scoring all of them is cheap.
 *
 * Never use `ILIKE '%q%'` without one of the indexed predicates next to it.
 */

export interface FoodSearchWeights {
  /** name_normalized = query */
  exact: number;
  /** name starts with query */
  prefix: number;
  /** word_similarity(query, name) ∈ [0,1]: typo tolerant, query may be part of a longer name */
  wordSimilarity: number;
  /** similarity(query, name) ∈ [0,1]: favours names that are not much longer than the query */
  similarity: number;
  /** word_similarity(query, brand) ∈ [0,1] */
  brand: number;
  /** ts_rank_cd(search_vector, tsquery, 32) ∈ [0,1): field weights A(name) > B(brand) > C(category) */
  fts: number;
  /** ln(1 + popularity) / ln(1 + 1e6), capped at 1 */
  popularity: number;
  /** flat bonus for the user's own foods and recipes */
  own: number;
}

export const DEFAULT_FOOD_SEARCH_WEIGHTS: FoodSearchWeights = {
  exact: 3,
  prefix: 1.5,
  wordSimilarity: 1,
  similarity: 0.5,
  brand: 0.3,
  fts: 1,
  popularity: 0.4,
  own: 0.5,
};

/**
 * Max candidates per access path (stage 1). Larger = better recall for very common tokens,
 * linearly more scoring work. Benchmarked defaults: ~850 rows scored worst case.
 */
export interface FoodSearchCandidateCaps {
  exact: number;
  prefix: number;
  fts: number;
  trigram: number;
  brand: number;
}

export const DEFAULT_CANDIDATE_CAPS: FoodSearchCandidateCaps = {
  exact: 50,
  prefix: 100,
  fts: 300,
  trigram: 300,
  brand: 100,
};

export interface FoodSearchSqlInput {
  /** Raw user input; normalized with normalizeFoodText() here. */
  query: string;
  /** Include this user's private foods + recipes. Null → public foods only. */
  userId: string | null;
  limit?: number;
  weights?: Partial<FoodSearchWeights>;
  candidateCaps?: Partial<FoodSearchCandidateCaps>;
}

export interface FoodSearchRow extends Record<string, unknown> {
  id: string;
  source: "usda" | "off" | "curated" | "user" | "recipe";
  name: string;
  brand_name: string | null;
  barcode: string | null;
  nutrient_basis: "g" | "ml";
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  data_quality: "verified" | "complete" | "partial" | "suspect";
  popularity: number;
  owner_user_id: string | null;
  score: number;
}

export interface NormalizedSearchQuery {
  /** normalizeFoodText(query) */
  q: string;
  /** q with LIKE wildcards escaped, for `LIKE q || '%'` */
  likePrefix: string;
  /** `to_tsquery('simple', …)` input: every token as prefix, AND-ed ("hafer:* & flo:*"), or null */
  tsquery: string | null;
  /** q shorter than 3 chars → trigram indexes are useless, use the btree prefix path */
  short: boolean;
}

export function normalizeSearchQuery(query: string): NormalizedSearchQuery {
  const q = normalizeFoodText(query);
  // normalizeFoodText leaves only letters, digits, whitespace and "%.,", none of which is
  // tsquery syntax. Trim edge punctuation and let to_tsquery's parser split "1,5" exactly like
  // to_tsvector did when indexing ("1,5" → '1' <-> '5', "3.5" → '3.5').
  const tokens = q
    .split(" ")
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((t) => /[\p{L}\p{N}]/u.test(t));
  return {
    q,
    likePrefix: q.replace(/[\\%_]/g, (c) => `\\${c}`) + "%",
    tsquery: tokens.length ? tokens.map((t) => `${t}:*`).join(" & ") : null,
    short: q.length < 3,
  };
}

const RESULT_COLUMNS = sql.raw(
  `f.id, f.source, f.name, f.brand_name, f.barcode, f.nutrient_basis, f.kcal, f.protein_g, f.carbs_g,
   f.fat_g, f.data_quality, f.popularity, f.owner_user_id`,
);

/**
 * Builds the reference search statement, or null for an empty query.
 * Result: public matches ∪ the user's own matches, ordered by combined score.
 *
 * Two stages: (1) bounded candidate generation per index (exact, prefix, FTS, trigram name,
 * trigram brand, own foods), (2) scoring of the candidates only. See database.md §6.
 */
export function buildFoodSearchSql(input: FoodSearchSqlInput): SQL | null {
  const nq = normalizeSearchQuery(input.query);
  if (!nq.q) return null;
  // Weights are code-controlled numbers → inline as float literals (a bound param next to an
  // int expression would be inferred as integer by Postgres).
  const merged = { ...DEFAULT_FOOD_SEARCH_WEIGHTS, ...input.weights };
  const w = Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [
      k,
      sql.raw(`${Number.isFinite(v) ? v : 0}::float8`),
    ]),
  ) as Record<keyof FoodSearchWeights, SQL>;
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const q = nq.q;

  const popularityScore = sql`${w.popularity} * least(ln(1 + f.popularity::float8) / ln(1000001::float8), 1)`;
  const qualityScore = sql`(case f.data_quality when 'verified' then 0.1 when 'suspect' then -0.3 else 0 end)`;

  if (nq.short) {
    // 1-2 characters: prefix only (btree text_pattern_ops), popular first.
    const own = input.userId
      ? sql`union all
          select ${RESULT_COLUMNS},
            ${w.exact} * (f.name_normalized = ${q})::int + ${w.prefix} + ${w.own} + ${popularityScore} as score
          from foods f
          where f.owner_user_id = ${input.userId} and not f.is_archived
            and f.name_normalized like ${nq.likePrefix}`
      : sql``;
    return sql`
      select * from (
        (select ${RESULT_COLUMNS},
            ${w.exact} * (f.name_normalized = ${q})::int + ${w.prefix} + ${popularityScore} + ${qualityScore} as score
          from foods f
          where f.visibility = 'public' and not f.is_archived
            and f.name_normalized like ${nq.likePrefix}
          order by f.popularity desc
          limit 200)
        ${own}
      ) r
      order by score desc, name asc
      limit ${limit}`;
  }

  // Values are inlined (not a params CTE) so the planner sees constants and can pick the
  // partial indexes per branch.
  const pq = sql`${q}::text`;
  const tsq = nq.tsquery
    ? sql`to_tsquery('simple', ${nq.tsquery})`
    : sql`null::tsquery`;
  const c = { ...DEFAULT_CANDIDATE_CAPS, ...input.candidateCaps };
  const cap = (n: number) => sql.raw(String(Math.max(1, Math.floor(n))));
  const PUB = sql.raw(`f.visibility = 'public' and not f.is_archived`);

  const score = sql`
      ${w.exact} * (f.name_normalized = ${pq})::int
    + ${w.prefix} * (f.name_normalized like ${nq.likePrefix})::int
    + ${w.wordSimilarity} * word_similarity(${pq}, f.name_normalized)
    + ${w.similarity} * similarity(${pq}, f.name_normalized)
    + ${w.brand} * coalesce(word_similarity(${pq}, f.brand_normalized), 0)
    + ${w.fts} * coalesce(ts_rank_cd(f.search_vector, ${tsq}, 32), 0)
    + ${popularityScore}
    + ${qualityScore}
    + ${input.userId ? sql`${w.own} * (f.owner_user_id is not distinct from ${input.userId})::int` : sql`0`}`;

  // Stage 2 of the own-foods branch needs no cap: a user owns at most a few thousand rows.
  const own = input.userId
    ? sql`union
        (select f.id from foods f
          where f.owner_user_id = ${input.userId} and not f.is_archived
            and (f.search_vector @@ ${tsq} or ${pq} <% f.name_normalized
              or f.name_normalized like ${nq.likePrefix}))`
    : sql``;

  // Stage 1: candidate generation: one bounded, index-driven branch per access path.
  //  - exact / prefix / FTS: "most popular among matches". Their selectivity estimates are good,
  //    so for a very common token ("milch") the planner walks foods_popularity_idx backwards and
  //    stops after `cap` hits; for a rare token it bitmap-scans the index and sorts a few rows.
  //  - trigram name: TYPO FALLBACK, only executed when FTS found fewer than its cap (uncorrelated
  //    sub-select → one-time filter, the branch is skipped entirely otherwise). `<%` costs
  //    ~2.5 µs/row and the planner underestimates that, so the branch sorts by `popularity + 0`
  //    (not indexable) to force the GIN bitmap instead of a long popularity-index walk or an
  //    early-stop seq scan: both measured 50-600 ms on misestimates.
  //  - trigram brand: same forced-bitmap shape, always on (brand hit sets are small).
  // UNION dedups. Stage 2: score only the candidates (≤ sum of caps rows).
  return sql`
    with fts as materialized (
      select f.id from foods f where ${PUB} and f.search_vector @@ ${tsq}
      order by f.popularity desc limit ${cap(c.fts)}
    ),
    candidates as (
      (select f.id from foods f where ${PUB} and f.name_normalized = ${pq}
        order by f.popularity desc limit ${cap(c.exact)})
      union
      (select f.id from foods f where ${PUB} and f.name_normalized like ${nq.likePrefix}
        order by f.popularity desc limit ${cap(c.prefix)})
      union
      (select id from fts)
      union
      (select f.id from foods f where ${PUB} and ${pq} <% f.name_normalized
        and (select count(*) from fts) < ${cap(c.fts)}
        order by f.popularity + 0 desc limit ${cap(c.trigram)})
      union
      (select f.id from foods f where ${PUB} and ${pq} <% f.brand_normalized
        order by f.popularity + 0 desc limit ${cap(c.brand)})
      ${own}
    )
    select ${RESULT_COLUMNS}, ${score} as score
    from candidates cand
    join foods f on f.id = cand.id
    order by score desc, f.name asc
    limit ${limit}`;
}

/** Runs the reference search. Food Search wraps this (or its own variant) in the search service. */
export async function searchFoodsReference(
  db: DbOrTx,
  input: FoodSearchSqlInput,
): Promise<FoodSearchRow[]> {
  const query = buildFoodSearchSql(input);
  if (!query) return [];
  return queryRows<FoodSearchRow>(db, query);
}
