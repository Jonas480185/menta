import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import {
  createTestEntry,
  createTestFood,
  createTestGoalProfile,
  createTestRecipe,
  createTestUserFood,
  createTestWaterEntry,
  createTestWeightEntry,
} from "@/test/factories";
import type { Db } from "./create";
import {
  activities,
  dailyNutrition,
  favoriteFoods,
  foodServings,
  foodUsage,
  foods,
  goalProfiles,
  mealEntries,
  meals,
  recipeIngredients,
  recipes,
  user,
  userProfiles,
  waterEntries,
  weightEntries,
} from "./schema";
import { queryRows } from "./sql";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

/** Walks the error cause chain (Drizzle wraps driver errors) and collects PG error fields. */
function pgError(err: unknown): {
  code?: string;
  constraint?: string;
  message: string;
} {
  let e: unknown = err;
  const messages: string[] = [];
  while (e && typeof e === "object") {
    const o = e as {
      code?: string;
      constraint?: string;
      message?: string;
      cause?: unknown;
    };
    if (o.message) messages.push(o.message);
    if (o.code && /^[0-9A-Z]{5}$/.test(o.code))
      return {
        code: o.code,
        constraint: o.constraint,
        message: messages.join(" | "),
      };
    e = o.cause;
  }
  return { message: messages.join(" | ") };
}

/** Expects `fn` to fail with the given SQLSTATE and (optionally) constraint name. */
async function expectDbError(
  fn: () => Promise<unknown>,
  code: string,
  constraint?: string,
) {
  let caught: unknown;
  try {
    await fn();
  } catch (err) {
    caught = err;
  }
  expect(caught, "expected the statement to be rejected").toBeDefined();
  const pg = pgError(caught);
  expect(pg.code, pg.message).toBe(code);
  if (constraint) {
    // PGlite does not always populate `constraint`; the name is always in the message.
    expect(pg.constraint ?? pg.message).toContain(constraint);
  }
}

const CHECK = "23514";
const FK = "23503";
const UNIQUE = "23505";

describe("CHECK constraints", () => {
  it("rejects negative and implausible food nutrients", async () => {
    await expectDbError(
      () => createTestFood(db, { kcal: -1 }),
      CHECK,
      "foods_nutrients_non_negative",
    );
    await expectDbError(
      () => createTestFood(db, { fiberG: -0.5 }),
      CHECK,
      "foods_nutrients_non_negative",
    );
    await expectDbError(
      () => createTestFood(db, { proteinG: 101 }),
      CHECK,
      "foods_nutrients_plausible",
    );
    await expectDbError(
      () => createTestFood(db, { proteinG: 40, carbsG: 40, fatG: 30 }),
      CHECK,
      "foods_nutrients_plausible",
    );
    await expectDbError(
      () => createTestFood(db, { kcal: 1200 }),
      CHECK,
      "foods_nutrients_plausible",
    );
  });

  it("accepts edge cases that are physically valid", async () => {
    // pure oil / pure sugar
    await createTestFood(db, {
      name: "Rapsöl",
      kcal: 884,
      proteinG: 0,
      carbsG: 0,
      fatG: 100,
    });
    await createTestFood(db, {
      name: "Zucker",
      kcal: 400,
      proteinG: 0,
      carbsG: 100,
      fatG: 0,
      sugarG: 100,
    });
    // rounding tolerance on P+C+F
    await createTestFood(db, {
      name: "Rundung",
      kcal: 500,
      proteinG: 34,
      carbsG: 34,
      fatG: 34,
    });
    // honey per 100 ml: > 100 g sugar is fine for dense liquids
    await createTestFood(db, {
      name: "Honig flüssig",
      nutrientBasis: "ml",
      densityGPerMl: 1.4,
      kcal: 430,
      proteinG: 0.4,
      carbsG: 115,
      fatG: 0,
      sugarG: 114,
    });
  });

  it("requires owner for user/recipe foods and none for database foods", async () => {
    const ctx = await createTestUser(db);
    await expectDbError(
      () => createTestFood(db, { source: "user" }),
      CHECK,
      "foods_owner_matches_source",
    );
    await expectDbError(
      () => createTestFood(db, { source: "off", ownerUserId: ctx.userId }),
      CHECK,
      "foods_owner_matches_source",
    );
    await expectDbError(
      () => createTestFood(db, { visibility: "private" }),
      CHECK,
      "foods_private_has_owner",
    );
    await expectDbError(
      () => createTestFood(db, { name: "   " }),
      CHECK,
      "foods_name_not_blank",
    );
  });

  it("rejects non-positive serving sizes", async () => {
    const food = await createTestFood(db);
    await expectDbError(
      () =>
        db
          .insert(foodServings)
          .values({ foodId: food.id, label: "0 g", unit: "g", grams: 0 }),
      CHECK,
      "food_servings_grams_positive",
    );
  });

  it("rejects invalid meal entries", async () => {
    const ctx = await createTestUser(db);
    const food = await createTestFood(db);
    const base = { mealId: ctx.mealIds.lunch, date: "2026-03-01", food };
    await expectDbError(
      () => createTestEntry(ctx, { ...base, quantity: 0 }),
      CHECK,
      "meal_entries_quantity_positive",
    );
    await expectDbError(
      () => createTestEntry(ctx, { ...base, overrides: { grams: -1 } }),
      CHECK,
      "meal_entries_grams_non_negative",
    );
    await expectDbError(
      () => createTestEntry(ctx, { ...base, overrides: { kcal: -10 } }),
      CHECK,
      "meal_entries_nutrients_non_negative",
    );
    // quick-add entries without a food and with 0 g are allowed
    const quick = await createTestEntry(ctx, {
      mealId: ctx.mealIds.snacks,
      date: "2026-03-01",
      overrides: { grams: 0, servingGrams: 0, kcal: 250 },
    });
    expect(quick.foodId).toBeNull();
  });

  it("prevents logging into another user's meal slot", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    await expectDbError(
      () =>
        createTestEntry(alice, {
          mealId: bob.mealIds.breakfast,
          date: "2026-03-01",
        }),
      FK,
      "meal_entries_meal_owner_fk",
    );
  });

  it("validates weight, water and body data ranges", async () => {
    const ctx = await createTestUser(db);
    await expectDbError(
      () => createTestWeightEntry(ctx, { date: "2026-01-01", weightKg: 19.9 }),
      CHECK,
    );
    await expectDbError(
      () => createTestWeightEntry(ctx, { date: "2026-01-02", weightKg: 401 }),
      CHECK,
    );
    await expectDbError(
      () => createTestWeightEntry(ctx, { date: "2026-01-03", bodyFatPct: 120 }),
      CHECK,
      "weight_entries_body_fat_range",
    );
    await createTestWeightEntry(ctx, { date: "2026-01-04", weightKg: 20 });
    await createTestWeightEntry(ctx, { date: "2026-01-05", weightKg: 400 });
    await expectDbError(
      () => createTestWeightEntry(ctx, { date: "2026-01-05", weightKg: 81 }),
      UNIQUE,
      "weight_entries_user_date_uq",
    );
    await expectDbError(
      () => createTestWaterEntry(ctx, { date: "2026-01-01", amountMl: 0 }),
      CHECK,
    );
    await expectDbError(
      () =>
        db
          .update(userProfiles)
          .set({ heightCm: 20 })
          .where(eq(userProfiles.userId, ctx.userId)),
      CHECK,
      "user_profiles_height_range",
    );
    await expectDbError(
      () =>
        db.insert(activities).values({
          userId: ctx.userId,
          date: "2026-01-01",
          type: "steps",
          name: "Gehen",
          steps: -5,
        }),
      CHECK,
      "activities_values_non_negative",
    );
  });

  it("validates goal profiles", async () => {
    const ctx = await createTestUser(db);
    await expectDbError(
      () => createTestGoalProfile(ctx, { calorieTarget: 0 }),
      CHECK,
    );
    await expectDbError(
      () => createTestGoalProfile(ctx, { proteinG: -1 }),
      CHECK,
    );
    await expectDbError(
      () => createTestGoalProfile(ctx, { proteinPct: 101 }),
      CHECK,
      "goal_profiles_pct_range",
    );
    await expectDbError(
      () => createTestGoalProfile(ctx, { kind: "training", weekdays: [1, 8] }),
      CHECK,
      "goal_profiles_weekdays_valid",
    );
    const lowCarb = await createTestGoalProfile(ctx, {
      kind: "low_carb",
      carbsG: 0,
      weekdays: [6, 7],
    });
    expect(lowCarb.isDefault).toBe(false);
  });

  it("enforces one active default goal profile per user", async () => {
    const ctx = await createTestUser(db);
    const first = await createTestGoalProfile(ctx);
    await expectDbError(
      () => createTestGoalProfile(ctx),
      UNIQUE,
      "goal_profiles_one_default_per_user",
    );
    // Other profiles (training/rest/...) are unlimited.
    await createTestGoalProfile(ctx, { kind: "training", weekdays: [1, 3, 5] });
    await createTestGoalProfile(ctx, { kind: "rest", weekdays: [2, 4] });
    // Switching the default: demote the old one first, then promote – inside one transaction.
    const other = await createTestGoalProfile(ctx, { kind: "refeed" });
    await db.transaction(async (tx) => {
      await tx
        .update(goalProfiles)
        .set({ isDefault: false })
        .where(eq(goalProfiles.id, first.id));
      await tx
        .update(goalProfiles)
        .set({ isDefault: true })
        .where(eq(goalProfiles.id, other.id));
    });
    // Archived profiles can't remain default.
    await expectDbError(
      () =>
        db
          .update(goalProfiles)
          .set({ archivedAt: new Date() })
          .where(eq(goalProfiles.id, other.id)),
      CHECK,
      "goal_profiles_default_not_archived",
    );
    // A different user has their own default.
    const ctx2 = await createTestUser(db);
    await createTestGoalProfile(ctx2);
  });
});

describe("delete behaviour", () => {
  it("deleting a user cascades to all of their data", async () => {
    const ctx = await createTestUser(db);
    const publicFood = await createTestFood(db);
    const ownFood = await createTestUserFood(ctx, { name: "Omas Kuchen" });
    const profile = await createTestGoalProfile(ctx);
    const { recipe } = await createTestRecipe(ctx, {
      ingredients: [
        { food: publicFood, grams: 200 },
        { food: ownFood, grams: 100 },
      ],
    });
    await createTestEntry(ctx, {
      mealId: ctx.mealIds.breakfast,
      date: "2026-04-01",
      food: ownFood,
    });
    await db
      .insert(favoriteFoods)
      .values({ userId: ctx.userId, foodId: publicFood.id });
    await db.insert(foodUsage).values({
      userId: ctx.userId,
      foodId: publicFood.id,
      useCount: 3,
      lastMealId: ctx.mealIds.lunch,
    });
    await db.insert(dailyNutrition).values({
      userId: ctx.userId,
      date: "2026-04-01",
      goalProfileId: profile.id,
      targetCalories: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 67,
    });
    await createTestWeightEntry(ctx, { date: "2026-04-01" });
    await createTestWaterEntry(ctx, { date: "2026-04-01" });

    await db.delete(user).where(eq(user.id, ctx.userId));

    const counts = await queryRows<{ t: string; n: number }>(
      db,
      sql`select 'meals' t, count(*)::int n from ${meals} where user_id = ${ctx.userId}
          union all select 'entries', count(*)::int from ${mealEntries} where user_id = ${ctx.userId}
          union all select 'foods', count(*)::int from ${foods} where owner_user_id = ${ctx.userId}
          union all select 'recipes', count(*)::int from ${recipes} where user_id = ${ctx.userId}
          union all select 'ingredients', count(*)::int from ${recipeIngredients} where recipe_id = ${recipe.id}
          union all select 'goals', count(*)::int from ${goalProfiles} where user_id = ${ctx.userId}
          union all select 'daily', count(*)::int from ${dailyNutrition} where user_id = ${ctx.userId}
          union all select 'weight', count(*)::int from ${weightEntries} where user_id = ${ctx.userId}
          union all select 'water', count(*)::int from ${waterEntries} where user_id = ${ctx.userId}
          union all select 'favorites', count(*)::int from ${favoriteFoods} where user_id = ${ctx.userId}
          union all select 'usage', count(*)::int from ${foodUsage} where user_id = ${ctx.userId}
          union all select 'profile', count(*)::int from ${userProfiles} where user_id = ${ctx.userId}`,
    );
    for (const c of counts) expect(c.n, c.t).toBe(0);
    // Shared public food survives.
    expect(
      await db.query.foods.findFirst({
        where: (f, { eq }) => eq(f.id, publicFood.id),
      }),
    ).toBeDefined();
  });

  it("deleting a meal slot that still has entries is restricted", async () => {
    const ctx = await createTestUser(db);
    await createTestEntry(ctx, {
      mealId: ctx.mealIds.dinner,
      date: "2026-04-02",
    });
    await expectDbError(
      () => db.delete(meals).where(eq(meals.id, ctx.mealIds.dinner)),
      FK,
      "meal_entries_meal_owner_fk",
    );
    // Empty slots can be deleted.
    await db.delete(meals).where(eq(meals.id, ctx.mealIds.snacks));
  });

  it("deleting a food nulls entry references but keeps the nutrient snapshot", async () => {
    const ctx = await createTestUser(db);
    const food = await createTestUserFood(ctx, {
      name: "Proteinriegel",
      kcal: 380,
      proteinG: 30,
      carbsG: 35,
      fatG: 12,
    });
    const entry = await createTestEntry(ctx, {
      mealId: ctx.mealIds.snacks,
      date: "2026-04-03",
      food,
      quantity: 2,
    });
    await db
      .insert(favoriteFoods)
      .values({ userId: ctx.userId, foodId: food.id });
    await db.insert(foodUsage).values({
      userId: ctx.userId,
      foodId: food.id,
      lastServingId: food.servings[1].id,
    });

    await db.delete(foods).where(eq(foods.id, food.id));

    const after = await db.query.mealEntries.findFirst({
      where: (e, { eq }) => eq(e.id, entry.id),
    });
    expect(after).toMatchObject({
      foodId: null,
      servingId: null,
      foodName: "Proteinriegel",
      grams: 60,
      kcal: 228,
      proteinG: 18,
    });
    expect(
      await db
        .select()
        .from(favoriteFoods)
        .where(eq(favoriteFoods.foodId, food.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(foodUsage).where(eq(foodUsage.foodId, food.id)),
    ).toHaveLength(0);
  });

  it("a food used as a recipe ingredient cannot be deleted (archive it instead)", async () => {
    const ctx = await createTestUser(db);
    const food = await createTestUserFood(ctx);
    await createTestRecipe(ctx, { ingredients: [{ food, grams: 150 }] });
    await expectDbError(
      () => db.delete(foods).where(eq(foods.id, food.id)),
      FK,
      "recipe_ingredients_food_id_foods_id_fk",
    );
    await db
      .update(foods)
      .set({ isArchived: true })
      .where(eq(foods.id, food.id));
  });

  it("deferred FK: inside a transaction the recipe-ingredient check fires at COMMIT", async () => {
    const ctx = await createTestUser(db);
    const food = await createTestUserFood(ctx);
    await createTestRecipe(ctx, { ingredients: [{ food, grams: 80 }] });
    await expectDbError(
      () =>
        db.transaction(async (tx) => {
          await tx.delete(foods).where(eq(foods.id, food.id)); // not rejected yet …
        }), // … but at commit
      FK,
      "recipe_ingredients_food_id_foods_id_fk",
    );
    expect(
      await db.query.foods.findFirst({
        where: (f, { eq }) => eq(f.id, food.id),
      }),
    ).toBeDefined();
  });

  it("deleting a recipe's food row unlinks the recipe and the goal profile unlinks daily rows", async () => {
    const ctx = await createTestUser(db);
    const ing = await createTestFood(db);
    const { recipe, food } = await createTestRecipe(ctx, {
      ingredients: [{ food: ing, grams: 100 }],
    });
    await db.delete(foods).where(eq(foods.id, food.id));
    const r = await db.query.recipes.findFirst({
      where: (t, { eq }) => eq(t.id, recipe.id),
    });
    expect(r?.foodId).toBeNull();

    const profile = await createTestGoalProfile(ctx, { kind: "training" });
    await db.insert(dailyNutrition).values({
      userId: ctx.userId,
      date: "2026-04-05",
      goalProfileId: profile.id,
      profileOverridden: true,
      targetCalories: 2400,
      targetProteinG: 160,
      targetCarbsG: 280,
      targetFatG: 70,
    });
    await db.delete(goalProfiles).where(eq(goalProfiles.id, profile.id));
    const day = await db.query.dailyNutrition.findFirst({
      where: (d, { and, eq }) =>
        and(eq(d.userId, ctx.userId), eq(d.date, "2026-04-05")),
    });
    // Frozen targets survive the profile.
    expect(day).toMatchObject({ goalProfileId: null, targetCalories: 2400 });
  });
});
