import { normalizeFoodText } from "@/domain/food/normalize";
import type { ServiceContext } from "@/server/context";
import type { Db, DbOrTx } from "@/server/db/create";
import {
  foods,
  foodServings,
  goalProfiles,
  mealEntries,
  recipeIngredients,
  recipes,
  waterEntries,
  weightEntries,
} from "@/server/db/schema";

/**
 * Test data factories on top of createTestDb()/createTestUser() (src/test/db.ts).
 * Every factory inserts valid rows (they satisfy all CHECK constraints) and returns the
 * inserted row(s). Pass overrides for what the test cares about, nothing else.
 */

type FoodInsert = typeof foods.$inferInsert;
type ServingInsert = Omit<typeof foodServings.$inferInsert, "foodId">;
export type FoodRow = typeof foods.$inferSelect;
export type ServingRow = typeof foodServings.$inferSelect;
export type TestFood = FoodRow & { servings: ServingRow[] };

let seq = 0;
const nextSeq = () => ++seq;

export interface TestFoodOverrides extends Partial<
  Omit<FoodInsert, "nameNormalized" | "brandNormalized">
> {
  /**
   * Servings to create. Default: a "100 g"/"100 ml" base serving plus "1 Portion (30 g)".
   * Pass [] for a food without extra servings (the 100-unit serving is always created).
   */
  servings?: ServingInsert[];
}

/**
 * Inserts a public food (source "curated") with servings. name_normalized/brand_normalized are
 * always derived via normalizeFoodText(): exactly like the real import pipeline.
 */
export async function createTestFood(
  db: DbOrTx,
  overrides: TestFoodOverrides = {},
): Promise<TestFood> {
  const { servings, ...rest } = overrides;
  const name = rest.name ?? `Testlebensmittel ${nextSeq()}`;
  const brandName = rest.brandName ?? null;
  const basis = rest.nutrientBasis ?? "g";
  const [food] = await db
    .insert(foods)
    .values({
      source: "curated",
      kcal: 100,
      proteinG: 5,
      carbsG: 10,
      fatG: 4,
      ...rest,
      name,
      nameNormalized: normalizeFoodText(name),
      brandName,
      brandNormalized: brandName ? normalizeFoodText(brandName) : null,
    })
    .returning();

  const base: ServingInsert = {
    label: `100 ${basis}`,
    amount: 100,
    unit: basis,
    grams: 100,
    sortOrder: 0,
  };
  const extra: ServingInsert[] = servings ?? [
    {
      label: `1 Portion (30 ${basis})`,
      amount: 1,
      unit: "serving",
      grams: 30,
      isDefault: true,
      sortOrder: 1,
    },
  ];
  const rows = await db
    .insert(foodServings)
    .values([base, ...extra].map((s) => ({ ...s, foodId: food.id })))
    .returning();
  return { ...food, servings: rows };
}

/** A private food owned by the context user (source "user"). */
export async function createTestUserFood(
  ctx: ServiceContext,
  overrides: TestFoodOverrides = {},
): Promise<TestFood> {
  return createTestFood(ctx.db, {
    source: "user",
    visibility: "private",
    ownerUserId: ctx.userId,
    ...overrides,
  });
}

export type GoalProfileRow = typeof goalProfiles.$inferSelect;

/** Goal profile for the context user. Defaults: the user's default profile, 2000 kcal, 150/200/67 g. */
export async function createTestGoalProfile(
  ctx: ServiceContext,
  overrides: Partial<Omit<typeof goalProfiles.$inferInsert, "userId">> = {},
): Promise<GoalProfileRow> {
  const isDefault =
    overrides.isDefault ??
    (overrides.kind === undefined || overrides.kind === "default");
  const [row] = await ctx.db
    .insert(goalProfiles)
    .values({
      name: isDefault ? "Standard" : "Profil",
      kind: "default",
      calorieTarget: 2000,
      proteinG: 150,
      carbsG: 200,
      fatG: 67,
      ...overrides,
      isDefault,
      userId: ctx.userId,
    })
    .returning();
  return row;
}

export type MealEntryRow = typeof mealEntries.$inferSelect;

export interface TestEntryInput {
  /** Meal slot id: typically one of createTestUser(...).mealIds. */
  mealId: string;
  date: string;
  /** Food to log. Omit for a "quick add" style entry (then pass kcal etc. yourself). */
  food?: TestFood;
  /** Serving to use (default: the food's default serving, else the first one). */
  servingId?: string;
  /** Number of servings (default 1). */
  quantity?: number;
  /** Snapshot overrides (kcal, foodName, …). */
  overrides?: Partial<typeof mealEntries.$inferInsert>;
}

/**
 * Logs an entry with a correct nutrient SNAPSHOT computed from the food
 * (nutrients per 100 units × grams / 100), like the Meal Logging service will.
 */
export async function createTestEntry(
  ctx: ServiceContext,
  input: TestEntryInput,
): Promise<MealEntryRow> {
  const quantity = input.quantity ?? 1;
  const food = input.food;
  const serving = food
    ? (food.servings.find((s) => s.id === input.servingId) ??
      food.servings.find((s) => s.isDefault) ??
      food.servings[0])
    : undefined;
  const servingGrams = serving?.grams ?? 100;
  const grams = servingGrams * quantity;
  const f = (per100: number | null | undefined) =>
    per100 == null ? null : (per100 * grams) / 100;

  const [row] = await ctx.db
    .insert(mealEntries)
    .values({
      userId: ctx.userId,
      date: input.date,
      mealId: input.mealId,
      foodId: food?.id ?? null,
      servingId: serving?.id ?? null,
      foodName: food?.name ?? "Schnell hinzugefügt",
      brandName: food?.brandName ?? null,
      servingLabel: serving?.label ?? "100 g",
      servingGrams,
      quantity,
      grams,
      kcal: f(food?.kcal) ?? 0,
      proteinG: f(food?.proteinG) ?? 0,
      carbsG: f(food?.carbsG) ?? 0,
      fatG: f(food?.fatG) ?? 0,
      fiberG: f(food?.fiberG),
      sugarG: f(food?.sugarG),
      saturatedFatG: f(food?.saturatedFatG),
      sodiumMg: f(food?.sodiumMg),
      ...input.overrides,
    })
    .returning();
  return row;
}

export async function createTestWeightEntry(
  ctx: ServiceContext,
  input: { date: string; weightKg?: number; bodyFatPct?: number | null },
) {
  const [row] = await ctx.db
    .insert(weightEntries)
    .values({
      userId: ctx.userId,
      date: input.date,
      weightKg: input.weightKg ?? 80,
      bodyFatPct: input.bodyFatPct,
    })
    .returning();
  return row;
}

export async function createTestWaterEntry(
  ctx: ServiceContext,
  input: { date: string; amountMl?: number },
) {
  const [row] = await ctx.db
    .insert(waterEntries)
    .values({
      userId: ctx.userId,
      date: input.date,
      amountMl: input.amountMl ?? 250,
    })
    .returning();
  return row;
}

/**
 * Recipe + its linked private food row (source "recipe") + ingredients, mirroring how the
 * Recipes service stores them. Nutrients of the linked food are the weighted
 * per-100 g average of the ingredients (no cooking loss).
 */
export async function createTestRecipe(
  ctx: ServiceContext,
  input: {
    name?: string;
    servings?: number;
    ingredients: { food: TestFood; grams: number }[];
  },
) {
  const name = input.name ?? `Testrezept ${nextSeq()}`;
  const servings = input.servings ?? 2;
  const totalG = input.ingredients.reduce((s, i) => s + i.grams, 0);
  const per100 = (pick: (f: TestFood) => number) =>
    totalG > 0
      ? input.ingredients.reduce(
          (s, i) => s + (pick(i.food) * i.grams) / 100,
          0,
        ) *
        (100 / totalG)
      : 0;

  const food = await createTestFood(ctx.db, {
    source: "recipe",
    visibility: "private",
    ownerUserId: ctx.userId,
    name,
    kcal: per100((f) => f.kcal),
    proteinG: per100((f) => f.proteinG),
    carbsG: per100((f) => f.carbsG),
    fatG: per100((f) => f.fatG),
    servings: [
      {
        label: "1 Portion",
        amount: 1,
        unit: "serving",
        grams: totalG / servings,
        isDefault: true,
        sortOrder: 1,
      },
    ],
  });
  const [recipe] = await ctx.db
    .insert(recipes)
    .values({ userId: ctx.userId, name, servings, foodId: food.id })
    .returning();
  const ingredients = await ctx.db
    .insert(recipeIngredients)
    .values(
      input.ingredients.map((i, idx) => ({
        recipeId: recipe.id,
        foodId: i.food.id,
        quantity: i.grams,
        grams: i.grams,
        sortOrder: idx,
      })),
    )
    .returning();
  return { recipe, food, ingredients };
}

/** Convenience for tests that only have a Db: wraps it into a ServiceContext. */
export function contextFor(
  db: Db,
  userId: string,
  timezone = "Europe/Berlin",
): ServiceContext {
  return { db, userId, timezone };
}
