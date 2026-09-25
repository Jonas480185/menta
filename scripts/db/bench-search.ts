/**
 * Food search benchmark.
 *
 *   pnpm db:bench-search                       # 200k foods, in-memory PGlite
 *   pnpm db:bench-search --rows=500000 --runs=30
 *
 * Fills a fresh in-memory PGlite (all migrations applied) with synthetic, German-ish foods
 * (realistic token distribution: generic + branded products, flavours, modifiers, Zipf-like
 * popularity, ~2 % private user foods), then runs the reference search queries
 * (src/server/db/food-search-sql.ts) and single-access-path queries with
 * EXPLAIN (ANALYZE, BUFFERS). Prints per-query latency (p50/p95 over --runs) and the
 * indexes each plan used, and fails (exit 1) if a query expected to be index-driven falls
 * back to a sequential scan on `foods`.
 *
 * Results are recorded in docs/architecture/database.md §7.
 */
import { performance } from "node:perf_hooks";
import { sql, type SQL } from "drizzle-orm";
import { normalizeFoodText } from "../../src/domain/food/normalize";
import { createDatabase, type Db } from "../../src/server/db/create";
import { buildFoodSearchSql } from "../../src/server/db/food-search-sql";
import { foods, user } from "../../src/server/db/schema";
import { queryRows } from "../../src/server/db/sql";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? "true"];
    }),
);
const ROWS = Number(args.rows ?? 200_000);
const RUNS = Number(args.runs ?? 20);
const USERS = 200;
const PRIVATE_SHARE = 0.02;

// ---------------------------------------------------------------------------------------------
// Deterministic synthetic data
// ---------------------------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
/** Zipf-ish pick: low indexes are much more frequent (realistic "Milch" vs "Pastinake"). */
const pickSkewed = <T>(xs: readonly T[]): T =>
  xs[Math.floor(xs.length * rand() ** 2.2)];

const PRODUCTS = [
  ["Milch", "Milchprodukte"],
  ["Joghurt", "Milchprodukte"],
  ["Quark", "Milchprodukte"],
  ["Käse", "Käse"],
  ["Gouda", "Käse"],
  ["Emmentaler", "Käse"],
  ["Mozzarella", "Käse"],
  ["Frischkäse", "Käse"],
  ["Butter", "Milchprodukte"],
  ["Sahne", "Milchprodukte"],
  ["Skyr", "Milchprodukte"],
  ["Hüttenkäse", "Käse"],
  ["Haferflocken", "Getreide"],
  ["Müsli", "Getreide"],
  ["Cornflakes", "Getreide"],
  ["Vollkornbrot", "Brot"],
  ["Toastbrot", "Brot"],
  ["Brötchen", "Brot"],
  ["Weißbrot", "Brot"],
  ["Knäckebrot", "Brot"],
  ["Nudeln", "Teigwaren"],
  ["Spaghetti", "Teigwaren"],
  ["Reis", "Getreide"],
  ["Basmatireis", "Getreide"],
  ["Hähnchenbrust", "Fleisch"],
  ["Putenbrust", "Fleisch"],
  ["Rinderhack", "Fleisch"],
  ["Schinken", "Wurst"],
  ["Salami", "Wurst"],
  ["Leberwurst", "Wurst"],
  ["Wiener Würstchen", "Wurst"],
  ["Lachs", "Fisch"],
  ["Thunfisch", "Fisch"],
  ["Fischstäbchen", "Fisch"],
  ["Eier", "Eier"],
  ["Apfel", "Obst"],
  ["Banane", "Obst"],
  ["Erdbeeren", "Obst"],
  ["Heidelbeeren", "Obst"],
  ["Orange", "Obst"],
  ["Kartoffeln", "Gemüse"],
  ["Tomaten", "Gemüse"],
  ["Gurke", "Gemüse"],
  ["Paprika", "Gemüse"],
  ["Brokkoli", "Gemüse"],
  ["Möhren", "Gemüse"],
  ["Zucchini", "Gemüse"],
  ["Linsen", "Hülsenfrüchte"],
  ["Kichererbsen", "Hülsenfrüchte"],
  ["Tofu", "Fleischersatz"],
  ["Mandeln", "Nüsse"],
  ["Erdnussbutter", "Nüsse"],
  ["Walnüsse", "Nüsse"],
  ["Schokolade", "Süßwaren"],
  ["Gummibärchen", "Süßwaren"],
  ["Kekse", "Süßwaren"],
  ["Proteinriegel", "Sportnahrung"],
  ["Whey Protein", "Sportnahrung"],
  ["Chips", "Snacks"],
  ["Pizza", "Fertiggerichte"],
  ["Lasagne", "Fertiggerichte"],
  ["Suppe", "Fertiggerichte"],
  ["Orangensaft", "Getränke"],
  ["Apfelschorle", "Getränke"],
  ["Cola", "Getränke"],
  ["Hafermilch", "Getränke"],
  ["Mineralwasser", "Getränke"],
  ["Eistee", "Getränke"],
  ["Ketchup", "Saucen"],
  ["Mayonnaise", "Saucen"],
  ["Pesto", "Saucen"],
  ["Honig", "Brotaufstrich"],
  ["Marmelade", "Brotaufstrich"],
  ["Nuss-Nougat-Creme", "Brotaufstrich"],
  ["Olivenöl", "Öle"],
  ["Rapsöl", "Öle"],
  ["Mehl", "Backzutaten"],
  ["Zucker", "Backzutaten"],
  ["Pastinake", "Gemüse"],
  ["Grünkohl", "Gemüse"],
  ["Rote Bete", "Gemüse"],
  ["Sauerkraut", "Gemüse"],
  ["Leinsamen", "Nüsse"],
] as const;
const MODIFIERS = [
  "Bio",
  "fettarm",
  "light",
  "Vollkorn",
  "zart",
  "kernig",
  "geräuchert",
  "gekocht",
  "natur",
  "laktosefrei",
  "zuckerfrei",
  "Protein",
  "extra",
  "fein",
  "grob",
  "klassisch",
  "original",
  "vegan",
  "TK",
  "Mini",
  "XXL",
  "griechischer Art",
  "3,5%",
  "1,5%",
  "0,1%",
  "mild",
  "würzig",
] as const;
const FLAVOURS = [
  "Erdbeere",
  "Vanille",
  "Schoko",
  "Himbeere",
  "Kirsch",
  "Pfirsich",
  "Nuss",
  "Karamell",
  "Mango",
  "Zitrone",
  "Kokos",
  "Banane",
  "Heidelbeere",
  "Kräuter",
  "Paprika",
  "Käse-Lauch",
] as const;
const REAL_BRANDS = [
  "Müller",
  "Zott",
  "Ehrmann",
  "Kölln",
  "Dr. Oetker",
  "Weihenstephan",
  "Alnatura",
  "Ja!",
  "Gut & Günstig",
  "K-Classic",
  "Milbona",
  "Landliebe",
  "Barilla",
  "Seitenbacher",
  "Rügenwalder",
  "Iglo",
  "Frosta",
  "Wagner",
  "Knorr",
  "Maggi",
  "Lindt",
  "Milka",
  "Haribo",
  "Bahlsen",
  "Oatly",
  "Alpro",
  "Arla",
  "Bärenmarke",
  "Leerdammer",
  "Philadelphia",
] as const;
const BRAND_SYL = [
  "Berg",
  "Land",
  "Hof",
  "Gold",
  "Frisch",
  "Natur",
  "Sonnen",
  "Wiesen",
  "Alpen",
  "Nord",
];
const BRAND_SUF = [
  "gut",
  "quell",
  "land",
  "hof",
  "mühle",
  "käserei",
  "bäcker",
  "feld",
  "werk",
  "garten",
];
const SYNTH_BRANDS = Array.from(
  { length: 400 },
  (_, i) =>
    `${BRAND_SYL[i % 10]}${BRAND_SUF[Math.floor(i / 10) % 10]}${i >= 100 ? ` ${Math.floor(i / 100)}` : ""}`,
);
const BRANDS = [...REAL_BRANDS, ...SYNTH_BRANDS];

function syntheticFood(
  i: number,
  userIds: string[],
): typeof foods.$inferInsert {
  const [product, category] = pickSkewed(PRODUCTS);
  const parts: string[] = [];
  if (rand() < 0.35) parts.push(pick(MODIFIERS));
  parts.push(product);
  if (rand() < 0.3) parts.push(pick(FLAVOURS));
  if (rand() < 0.2) parts.push(pick(MODIFIERS));
  const name = parts.join(" ");
  const branded = rand() < 0.8;
  const brandName = branded ? pickSkewed(BRANDS) : null;
  const isPrivate = rand() < PRIVATE_SHARE;
  // Macro shares of a ≤ 95 g dry mass per 100 g (satisfies foods_nutrients_plausible).
  const [p, c, f] = [rand(), rand() * 2, rand()];
  const mass = 20 + rand() * 75;
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const protein = round1((mass * p) / (p + c + f));
  const carbs = round1((mass * c) / (p + c + f));
  const fat = round1((mass * f) / (p + c + f));
  return {
    source: isPrivate ? "user" : branded ? "off" : "usda",
    sourceId: isPrivate ? null : String(i),
    ownerUserId: isPrivate ? pick(userIds) : null,
    visibility: isPrivate ? "private" : "public",
    name,
    nameNormalized: normalizeFoodText(name),
    brandName,
    brandNormalized: brandName ? normalizeFoodText(brandName) : null,
    barcode: branded && !isPrivate ? String(4000000000000 + i) : null,
    category,
    kcal: Math.round(protein * 4 + carbs * 4 + fat * 9),
    proteinG: protein,
    carbsG: carbs,
    fatG: fat,
    popularity: Math.floor(Math.exp(rand() ** 3 * 11)) - 1,
    isArchived: rand() < 0.01,
  };
}

async function load(db: Db) {
  const userIds = Array.from({ length: USERS }, (_, i) => `bench-user-${i}`);
  await db
    .insert(user)
    .values(
      userIds.map((id) => ({ id, name: id, email: `${id}@example.com` })),
    );
  const t0 = performance.now();
  const BATCH = 1000;
  for (let i = 0; i < ROWS; i += BATCH) {
    const rows = Array.from({ length: Math.min(BATCH, ROWS - i) }, (_, j) =>
      syntheticFood(i + j, userIds),
    );
    await db.insert(foods).values(rows);
    if ((i / BATCH) % 25 === 0)
      process.stdout.write(
        `\r  loading ${i.toLocaleString("de-DE")} / ${ROWS.toLocaleString("de-DE")}`,
      );
  }
  const loadMs = performance.now() - t0;
  const t1 = performance.now();
  await db.execute(sql`analyze`);
  console.log(
    `\r  loaded ${ROWS.toLocaleString("de-DE")} foods in ${(loadMs / 1000).toFixed(1)} s (analyze ${((performance.now() - t1) / 1000).toFixed(1)} s)`,
  );
  return userIds;
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------
interface BenchQuery {
  name: string;
  query: SQL;
  /** false = the query is a deliberate anti-pattern baseline */
  expectIndex: boolean;
}

function queries(userId: string): BenchQuery[] {
  const ref = (q: string) =>
    buildFoodSearchSql({ query: q, userId, limit: 25 })!;
  const PUB = sql.raw(`visibility = 'public' AND NOT is_archived`);
  return [
    {
      name: "ref: 'haferflocken' (exact word)",
      query: ref("haferflocken"),
      expectIndex: true,
    },
    {
      name: "ref: 'milch' (very common token)",
      query: ref("milch"),
      expectIndex: true,
    },
    {
      name: "ref: 'joghurt erdbeere' (2 words)",
      query: ref("joghurt erdbeere"),
      expectIndex: true,
    },
    {
      name: "ref: 'hähnchenbr' (typing, umlaut)",
      query: ref("hähnchenbr"),
      expectIndex: true,
    },
    {
      name: "ref: 'haferflokcen' (typo)",
      query: ref("haferflokcen"),
      expectIndex: true,
    },
    {
      name: "ref: 'mueller joghurt' (brand+product)",
      query: ref("müller joghurt"),
      expectIndex: true,
    },
    {
      name: "ref: 'pastinake' (rare)",
      query: ref("pastinake"),
      expectIndex: true,
    },
    {
      name: "ref: 'ha' (short → prefix path)",
      query: ref("ha"),
      expectIndex: true,
    },
    {
      name: "exact name (btree prefix idx)",
      query: sql`select id from foods where ${PUB} and name_normalized = 'haferflocken' limit 25`,
      expectIndex: true,
    },
    {
      name: "FTS only: count(hafer:*)",
      query: sql`select count(*) from foods where ${PUB} and search_vector @@ to_tsquery('simple', 'hafer:*')`,
      expectIndex: true,
    },
    {
      name: "trigram only: count('haferflokcen' <% name)",
      query: sql`select count(*) from foods where ${PUB} and 'haferflokcen' <% name_normalized`,
      expectIndex: true,
    },
    {
      name: "brand trigram only: count('mueler' <% brand)",
      query: sql`select count(*) from foods where ${PUB} and 'mueler' <% brand_normalized`,
      expectIndex: true,
    },
    {
      name: "barcode lookup",
      query: sql`select id from foods where barcode = '4000000012345'`,
      expectIndex: true,
    },
    {
      name: "own foods list (owner idx)",
      query: sql`select id, name from foods where owner_user_id = ${userId} and not is_archived order by name_normalized limit 50`,
      expectIndex: true,
    },
    {
      name: "BASELINE anti-pattern: lower(name) LIKE '%hafer%'",
      query: sql`select id from foods where lower(name) like '%haferflocken%' order by popularity desc limit 25`,
      expectIndex: false,
    },
  ];
}

interface PlanInfo {
  indexes: string[];
  seqScanOnFoods: boolean;
  executionMs: number;
  sharedHit: number;
  sharedRead: number;
}

function parsePlan(lines: string[]): PlanInfo {
  const text = lines.join("\n");
  const indexes = new Set<string>();
  for (const m of text.matchAll(
    /(?:Index Only Scan|Index Scan)(?: Backward)? using (\w+)|Bitmap Index Scan on (\w+)/g,
  )) {
    indexes.add(m[1] ?? m[2]);
  }
  const exec = /Execution Time: ([\d.]+) ms/.exec(text);
  let sharedHit = 0;
  let sharedRead = 0;
  // Top-level buffers line (first occurrence is the root node = totals).
  const buf = /Buffers: shared(?: hit=(\d+))?(?: read=(\d+))?/.exec(text);
  if (buf) {
    sharedHit = Number(buf[1] ?? 0);
    sharedRead = Number(buf[2] ?? 0);
  }
  return {
    indexes: [...indexes],
    seqScanOnFoods: /Seq Scan on foods/.test(text),
    executionMs: exec ? Number(exec[1]) : NaN,
    sharedHit,
    sharedRead,
  };
}

const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function main() {
  console.log(
    `Food search benchmark – ${ROWS.toLocaleString("de-DE")} foods, ${RUNS} runs/query (PGlite, in-memory)\n`,
  );
  const t0 = performance.now();
  const db = await createDatabase({
    pgliteDataDir: "memory://",
    migrate: true,
    url: "",
  });
  console.log(
    `  migrations applied in ${((performance.now() - t0) / 1000).toFixed(1)} s`,
  );
  const userIds = await load(db);

  const [size] = await queryRows<{ table_mb: string; indexes: string }>(
    db,
    sql`select pg_size_pretty(pg_table_size('foods')) as table_mb,
        (select string_agg(indexrelname || '=' || pg_size_pretty(pg_relation_size(indexrelid)), ', ' order by indexrelname)
           from pg_stat_user_indexes where relname = 'foods') as indexes`,
  );
  console.log(`  foods table ${size.table_mb}; indexes: ${size.indexes}\n`);

  const results: {
    name: string;
    p50: number;
    p95: number;
    rows: number;
    plan: PlanInfo;
    ok: boolean;
  }[] = [];
  for (const q of queries(userIds[0]).filter(
    (x) => !args.only || x.name.includes(String(args.only)),
  )) {
    const planRows = await queryRows<{ "QUERY PLAN": string }>(
      db,
      sql`explain (analyze, buffers) ${q.query}`,
    );
    const plan = parsePlan(planRows.map((r) => r["QUERY PLAN"]));
    if (args.verbose)
      console.log(
        `\n### ${q.name}\n${planRows.map((r) => r["QUERY PLAN"]).join("\n")}`,
      );
    let rows = 0;
    const times: number[] = [];
    for (let i = 0; i < RUNS + 2; i++) {
      const t = performance.now();
      const r = await queryRows(db, q.query);
      const dt = performance.now() - t;
      if (i >= 2) times.push(dt); // 2 warm-up runs
      rows = r.length;
    }
    const ok =
      !q.expectIndex || (!plan.seqScanOnFoods && plan.indexes.length > 0);
    results.push({
      name: q.name,
      p50: percentile(times, 50),
      p95: percentile(times, 95),
      rows,
      plan,
      ok,
    });
  }

  console.log(
    "| Query | rows | p50 ms | p95 ms | exec ms (EXPLAIN) | buffers hit | indexes used | ok |",
  );
  console.log("|---|---:|---:|---:|---:|---:|---|---|");
  for (const r of results) {
    console.log(
      `| ${r.name} | ${r.rows} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.plan.executionMs.toFixed(1)} | ${r.plan.sharedHit} | ${r.plan.indexes.join(", ") || (r.plan.seqScanOnFoods ? "**Seq Scan**" : "–")} | ${r.ok ? "✓" : "✗"} |`,
    );
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(
      `\n✗ ${failed.length} query/queries expected to be index-driven used a Seq Scan on foods`,
    );
    process.exit(1);
  }
  console.log("\n✓ all index-driven queries avoided sequential scans on foods");
  process.exit(0);
}

main().catch((err: unknown) => {
  // Drizzle errors embed the full (huge) statement – print only the driver cause.
  const cause = (err as { cause?: unknown }).cause ?? err;
  console.error(
    cause instanceof Error ? `${cause.name}: ${cause.message}` : cause,
  );
  process.exit(1);
});
