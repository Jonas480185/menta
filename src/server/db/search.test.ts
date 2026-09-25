import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { normalizeFoodText } from "@/domain/food/normalize";
import { createTestDb, createTestUser } from "@/test/db";
import { createTestFood, createTestUserFood } from "@/test/factories";
import type { Db } from "./create";
import {
  buildFoodSearchSql,
  normalizeSearchQuery,
  searchFoodsReference,
} from "./food-search-sql";
import { queryRows } from "./sql";

let db: Db;
let aliceId: string;
let bobId: string;

beforeAll(async () => {
  db = await createTestDb();
  const alice = await createTestUser(db);
  const bob = await createTestUser(db);
  aliceId = alice.userId;
  bobId = bob.userId;

  const publicFoods: Parameters<typeof createTestFood>[1][] = [
    {
      name: "Haferflocken",
      brandName: "Kölln",
      category: "Getreide",
      popularity: 900,
      kcal: 372,
      proteinG: 13.5,
      carbsG: 58.7,
      fatG: 7,
    },
    {
      name: "Haferflocken zart",
      brandName: "Ja!",
      category: "Getreide",
      popularity: 300,
    },
    {
      name: "Hafermilch Barista",
      brandName: "Oatly",
      category: "Getränke",
      nutrientBasis: "ml",
      popularity: 500,
    },
    {
      name: "Hähnchenbrustfilet",
      brandName: "Wiesenhof",
      category: "Fleisch",
      popularity: 800,
      kcal: 110,
      proteinG: 23,
      carbsG: 0,
      fatG: 1.5,
    },
    { name: "Weißbrot", brandName: null, category: "Brot", popularity: 200 },
    {
      name: "Crème fraîche",
      brandName: "Müller",
      category: "Milchprodukte",
      popularity: 150,
    },
    {
      name: "Fettarme Milch 1,5%",
      brandName: "Weihenstephan",
      category: "Milchprodukte",
      nutrientBasis: "ml",
      popularity: 700,
    },
    {
      name: "Müsli Schoko",
      brandName: "Seitenbacher",
      category: "Getreide",
      popularity: 100,
    },
    { name: "Apfel", brandName: null, category: "Obst", popularity: 1000 },
    {
      name: "Archivierte Haferflocken",
      brandName: null,
      isArchived: true,
      popularity: 5000,
    },
  ];
  for (const f of publicFoods) await createTestFood(db, f);

  await createTestUserFood(alice, { name: "Omas Haferkekse", popularity: 0 });
  await createTestUserFood(bob, {
    name: "Bobs geheime Haferpampe",
    popularity: 0,
  });
});

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe("normalizeSearchQuery", () => {
  it("folds umlauts/ß and builds a safe prefix tsquery", () => {
    expect(normalizeSearchQuery("Weißbrot")).toMatchObject({
      q: "weissbrot",
      tsquery: "weissbrot:*",
    });
    expect(normalizeSearchQuery("  Hähnchen  Brust ")).toMatchObject({
      q: "hahnchen brust",
      tsquery: "hahnchen:* & brust:*",
    });
    expect(normalizeSearchQuery("milch 1,5%")).toMatchObject({
      tsquery: "milch:* & 1,5:*",
      likePrefix: "milch 1,5\\%%",
    });
    expect(normalizeSearchQuery("a & b | !c:*")).toMatchObject({
      tsquery: "a:* & b:* & c:*",
    });
    expect(normalizeSearchQuery("ha").short).toBe(true);
    expect(buildFoodSearchSql({ query: "   ", userId: null })).toBeNull();
  });
});

describe("search_vector (generated column)", () => {
  it("is maintained by Postgres with name > brand > category weights", async () => {
    const [row] = await queryRows<{ v: string }>(
      db,
      sql`select search_vector::text as v from foods where name = 'Crème fraîche'`,
    );
    expect(row.v).toContain("'creme':1A");
    expect(row.v).toContain("'fraiche':2A");
    expect(row.v).toContain("'muller':3B");
    expect(row.v).toContain("'milchprodukte':4C");
    const [drink] = await queryRows<{ v: string }>(
      db,
      sql`select search_vector::text as v from foods where name = 'Hafermilch Barista'`,
    );
    // category is folded inside the generated expression (translate(), which is IMMUTABLE)
    expect(drink.v).toContain("'getranke':4C");
  });

  it("matches word prefixes with FTS", async () => {
    const rows = await queryRows<{ name: string }>(
      db,
      sql`select name from foods where search_vector @@ to_tsquery('simple', 'hafer:*') and visibility = 'public' and not is_archived order by name`,
    );
    expect(names(rows)).toEqual([
      "Haferflocken",
      "Haferflocken zart",
      "Hafermilch Barista",
    ]);
  });

  it("finds foods by trigram word similarity despite typos", async () => {
    const rows = await queryRows<{ name: string }>(
      db,
      sql`select name from foods where ${normalizeFoodText("Haferflokcen")} <% name_normalized
          and visibility = 'public' and not is_archived order by name`,
    );
    expect(names(rows)).toEqual(
      expect.arrayContaining(["Haferflocken", "Haferflocken zart"]),
    );
  });
});

describe("reference search (searchFoodsReference)", () => {
  it("ranks the exact match first", async () => {
    const rows = await searchFoodsReference(db, {
      query: "Haferflocken",
      userId: null,
    });
    expect(rows[0].name).toBe("Haferflocken");
    expect(names(rows)).toContain("Haferflocken zart");
  });

  it("folds umlauts and ß in both directions", async () => {
    expect(
      (
        await searchFoodsReference(db, { query: "hähnchenbrust", userId: null })
      )[0].name,
    ).toBe("Hähnchenbrustfilet");
    expect(
      (await searchFoodsReference(db, { query: "WEISSBROT", userId: null }))[0]
        .name,
    ).toBe("Weißbrot");
    expect(
      (await searchFoodsReference(db, { query: "weißbrot", userId: null }))[0]
        .name,
    ).toBe("Weißbrot");
    expect(
      (
        await searchFoodsReference(db, { query: "creme fraiche", userId: null })
      )[0].name,
    ).toBe("Crème fraîche");
  });

  it("tolerates typos", async () => {
    const rows = await searchFoodsReference(db, {
      query: "Haferflokcen",
      userId: null,
    });
    expect(rows[0].name).toMatch(/^Haferflocken/);
  });

  it("matches multi-word queries out of order and by brand", async () => {
    expect(
      (
        await searchFoodsReference(db, { query: "milch fettarm", userId: null })
      )[0].name,
    ).toBe("Fettarme Milch 1,5%");
    expect(
      names(await searchFoodsReference(db, { query: "müller", userId: null })),
    ).toContain("Crème fraîche");
    expect(
      names(
        await searchFoodsReference(db, { query: "kolln hafer", userId: null }),
      )[0],
    ).toBe("Haferflocken");
  });

  it("returns public foods plus only the requesting user's own foods, never archived ones", async () => {
    const asAlice = names(
      await searchFoodsReference(db, {
        query: "hafer",
        userId: aliceId,
        limit: 50,
      }),
    );
    expect(asAlice).toContain("Omas Haferkekse");
    expect(asAlice).not.toContain("Bobs geheime Haferpampe");
    expect(asAlice).not.toContain("Archivierte Haferflocken");

    const anonymous = names(
      await searchFoodsReference(db, {
        query: "hafer",
        userId: null,
        limit: 50,
      }),
    );
    expect(anonymous).not.toContain("Omas Haferkekse");
    expect(
      names(await searchFoodsReference(db, { query: "hafer", userId: bobId })),
    ).toContain("Bobs geheime Haferpampe");
  });

  it("uses the prefix path for 1–2 character queries", async () => {
    const rows = await searchFoodsReference(db, {
      query: "Ha",
      userId: aliceId,
    });
    expect(names(rows).slice(0, 3)).toEqual(
      expect.arrayContaining(["Haferflocken"]),
    );
    expect(names(rows)).toContain("Hähnchenbrustfilet");
    expect(names(rows)).not.toContain("Apfel");
    expect(
      names(await searchFoodsReference(db, { query: "om", userId: aliceId })),
    ).toEqual(["Omas Haferkekse"]);
  });

  it("returns nothing for an empty query and doesn't choke on LIKE/tsquery metacharacters", async () => {
    expect(await searchFoodsReference(db, { query: "", userId: null })).toEqual(
      [],
    );
    await expect(
      searchFoodsReference(db, { query: "100% _ \\ ' : & |", userId: aliceId }),
    ).resolves.toBeInstanceOf(Array);
    await expect(
      searchFoodsReference(db, { query: "%", userId: aliceId }),
    ).resolves.toEqual([]);
  });
});

describe("index usage", () => {
  // With a dozen rows every plan is "cheap"; give the planner realistic statistics.
  beforeAll(async () => {
    await db.execute(sql`
      insert into foods (source, name, name_normalized, kcal, protein_g, carbs_g, fat_g, popularity)
      select 'curated', 'Füllprodukt ' || g, 'fullprodukt ' || md5(g::text), 100, 5, 10, 4, g % 100
      from generate_series(1, 5000) g`);
    await db.execute(sql`analyze foods`);
  });

  /** EXPLAIN with seq scans disabled – proves the query shape CAN use the partial indexes. */
  async function plan(
    query: ReturnType<typeof buildFoodSearchSql>,
  ): Promise<string> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      const rows = await queryRows<{ "QUERY PLAN": string }>(
        tx,
        sql`explain ${query}`,
      );
      return rows.map((r) => r["QUERY PLAN"]).join("\n");
    });
  }

  it("full search candidate branches use the partial indexes (trigram GIN at scale: see bench-search)", async () => {
    const p = await plan(
      buildFoodSearchSql({ query: "haferflocken", userId: aliceId }),
    );
    expect(p).toContain("foods_search_vector_idx");
            expect(p).toContain("foods_owner_idx");
  });

  it("short queries use the text_pattern_ops prefix index", async () => {
    const p = await plan(buildFoodSearchSql({ query: "ha", userId: null }));
    expect(p).toContain("foods_name_prefix_idx");
  });
});
