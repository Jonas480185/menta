import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import { foods, foodServings } from "@/server/db/schema";
import { normalizeFoodText } from "@/domain/food/normalize";
import { resolveGoalProfileForDate } from "@/server/services/goals/resolve";
import type { Db } from "@/server/db/create";
import { queryRows } from "@/server/db/sql";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

describe("database foundation", () => {
  it("applies migrations incl. search extensions", async () => {
    const rows = await queryRows<{ extname: string }>(db, sql`select extname from pg_extension`);
    const names = rows.map((r) => r.extname);
    expect(names).toEqual(expect.arrayContaining(["pg_trgm", "unaccent"]));
  });

  it("stores a food with servings", async () => {
    const [food] = await db
      .insert(foods)
      .values({
        source: "curated",
        name: "Haferflocken",
        nameNormalized: normalizeFoodText("Haferflocken"),
        kcal: 372,
        proteinG: 13.5,
        carbsG: 58.7,
        fatG: 7,
      })
      .returning();
    await db.insert(foodServings).values([
      { foodId: food.id, label: "100 g", amount: 100, unit: "g", grams: 100 },
      { foodId: food.id, label: "1 EL", amount: 1, unit: "tbsp", grams: 10, isDefault: true },
    ]);
    const loaded = await db.query.foods.findFirst({
      where: (f, { eq }) => eq(f.id, food.id),
      with: { servings: true },
    });
    expect(loaded?.servings).toHaveLength(2);
  });

  it("creates test users with default meals and no goal profile", async () => {
    const ctx = await createTestUser(db);
    expect(Object.keys(ctx.mealIds)).toHaveLength(4);
    expect(await resolveGoalProfileForDate(ctx, "2026-01-01")).toBeNull();
  });
});

describe("normalizeFoodText", () => {
  it.each([
    ["Hähnchenbrust  Filet", "hahnchenbrust filet"],
    ["Crème fraîche", "creme fraiche"],
    ["Weißbrot", "weissbrot"],
    ["Milch 1,5% Fett", "milch 1,5% fett"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeFoodText(input)).toBe(expected);
  });
});
