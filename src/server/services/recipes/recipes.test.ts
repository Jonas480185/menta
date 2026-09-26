import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import { createTestEntry, createTestFood, createTestUserFood, type TestFood } from "@/test/factories";
import type { Db } from "@/server/db/create";
import { foods, foodServings, mealEntries, recipeIngredients, recipes } from "@/server/db/schema";
import {
  createRecipe,
  deleteRecipe,
  duplicateRecipe,
  getRecipe,
  listRecipes,
  searchIngredientFoods,
  updateRecipe,
} from "./index";

let db: Db;
let chicken: TestFood;
let rice: TestFood;
let coconut: TestFood;

beforeAll(async () => {
  db = await createTestDb();
  chicken = await createTestFood(db, {
    name: "Hähnchenbrust roh",
    kcal: 110,
    proteinG: 23,
    carbsG: 0,
    fatG: 1.5,
    fiberG: 0,
  });
  rice = await createTestFood(db, {
    name: "Basmatireis trocken",
    kcal: 350,
    proteinG: 7,
    carbsG: 76,
    fatG: 0.6,
    fiberG: 1.5,
    servings: [
      { label: "1 Tasse (200 g)", amount: 1, unit: "cup", grams: 200, isDefault: true, sortOrder: 1 },
    ],
  });
  coconut = await createTestFood(db, {
    name: "Kokosmilch",
    kcal: 110,
    proteinG: 4,
    carbsG: 0,
    fatG: 11.45,
  });
});

const base = (servingId: string | null = null) => ({
  name: "Chicken Curry",
  description: "Mild und cremig",
  servings: 4,
  totalWeightG: null,
  ingredients: [
    { foodId: chicken.id, servingId: null, quantity: 600 },
    { foodId: rice.id, servingId: servingId ?? rice.servings.find((s) => s.isDefault)!.id, quantity: 1 },
    { foodId: coconut.id, servingId: null, quantity: 400 },
  ],
});

async function linkedFood(foodId: string) {
  const [food] = await db.select().from(foods).where(eq(foods.id, foodId));
  const servings = await db.select().from(foodServings).where(eq(foodServings.foodId, foodId));
  return { food, servings };
}

describe("createRecipe", () => {
  it("creates the recipe, ingredients and a linked private food with per-100 g nutrients", async () => {
    const ctx = await createTestUser(db);
    const { id, foodId } = await createRecipe(ctx, base());

    const detail = await getRecipe(ctx, id);
    expect(detail.name).toBe("Chicken Curry");
    expect(detail.foodId).toBe(foodId);
    expect(detail.ingredients).toHaveLength(3);
    expect(detail.ingredients[1].food.name).toBe("Basmatireis trocken");
    expect(detail.ingredients[1].servingLabel).toBe("1 Tasse (200 g)");
    expect(detail.ingredients[1].grams).toBe(200);
    expect(detail.nutrition.perServing.kcal).toBeCloseTo(450);
    expect(detail.nutrition.perServing.proteinG).toBeCloseTo(42);
    expect(detail.nutrition.perServing.carbsG).toBeCloseTo(38);
    expect(detail.nutrition.perServing.fatG).toBeCloseTo(14);
    // fiber: chicken 0, rice 3, coconut unknown → sum of known, flagged incomplete
    expect(detail.nutrition.totals.fiberG).toBeCloseTo(3);
    expect(detail.nutrition.incomplete).toContain("fiberG");

    const { food, servings } = await linkedFood(foodId);
    expect(food).toMatchObject({
      source: "recipe",
      sourceId: id,
      ownerUserId: ctx.userId,
      visibility: "private",
      name: "Chicken Curry",
      nameNormalized: "chicken curry",
      nutrientBasis: "g",
      isArchived: false,
      dataQuality: "partial",
    });
    expect(food.kcal).toBeCloseTo(150);
    const portion = servings.find((s) => s.unit === "serving")!;
    expect(portion.grams).toBeCloseTo(300);
    expect(portion.isDefault).toBe(true);
    expect(portion.label).toBe("1 Portion (≈ 300 g)");
    expect(servings.find((s) => s.unit === "g")?.grams).toBe(100);
    expect(detail.portionServingId).toBe(portion.id);
  });

  it("uses the cooked weight for per-100 g and portion grams", async () => {
    const ctx = await createTestUser(db);
    const { foodId } = await createRecipe(ctx, { ...base(), totalWeightG: 1000 });
    const { food, servings } = await linkedFood(foodId);
    expect(food.kcal).toBeCloseTo(180);
    expect(servings.find((s) => s.unit === "serving")!.grams).toBeCloseTo(250);
  });

  it("rejects implausibly low cooked weights", async () => {
    const ctx = await createTestUser(db);
    await expect(createRecipe(ctx, { ...base(), totalWeightG: 100 })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { totalWeightG: [expect.stringContaining("mindestens")] },
    });
  });

  it("validates input with German field errors", async () => {
    const ctx = await createTestUser(db);
    await expect(createRecipe(ctx, { ...base(), name: "  ", ingredients: [] })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: {
        name: ["Bitte gib einen Namen ein."],
        ingredients: ["Füge mindestens eine Zutat hinzu."],
      },
    });
    await expect(createRecipe(ctx, { ...base(), servings: 0 })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects a serving that belongs to another food", async () => {
    const ctx = await createTestUser(db);
    const input = base();
    input.ingredients[0].servingId = rice.servings[0].id;
    input.ingredients[0].quantity = 1;
    await expect(createRecipe(ctx, input)).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { "ingredients.0.servingId": [expect.any(String)] },
    });
  });

  it("allows own private foods but not other users' private foods", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    const aliceFood = await createTestUserFood(alice, { name: "Alices Soße", kcal: 80 });
    const own = await createRecipe(alice, {
      ...base(),
      ingredients: [{ foodId: aliceFood.id, servingId: null, quantity: 100 }],
    });
    expect(own.id).toBeTruthy();

    await expect(
      createRecipe(bob, {
        ...base(),
        ingredients: [{ foodId: aliceFood.id, servingId: null, quantity: 100 }],
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { "ingredients.0.foodId": [expect.any(String)] },
    });
  });

  it("rejects archived foods as new ingredients", async () => {
    const ctx = await createTestUser(db);
    const archived = await createTestFood(db, { name: "Alter Joghurt", isArchived: true });
    await expect(
      createRecipe(ctx, {
        ...base(),
        ingredients: [{ foodId: archived.id, servingId: null, quantity: 100 }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("updateRecipe", () => {
  it("replaces ingredients and keeps the linked food (and its serving ids) in sync", async () => {
    const ctx = await createTestUser(db);
    const { id, foodId } = await createRecipe(ctx, base());
    const before = await linkedFood(foodId);

    const result = await updateRecipe(ctx, id, {
      name: "Curry light",
      description: "",
      servings: 2,
      totalWeightG: null,
      ingredients: [{ foodId: chicken.id, servingId: null, quantity: 400 }],
    });
    expect(result).toEqual({ id, foodId });

    const detail = await getRecipe(ctx, id);
    expect(detail.name).toBe("Curry light");
    expect(detail.description).toBeNull();
    expect(detail.ingredients).toHaveLength(1);
    expect(detail.nutrition.perServing.kcal).toBeCloseTo(220);

    const after = await linkedFood(foodId);
    expect(after.food.name).toBe("Curry light");
    expect(after.food.kcal).toBeCloseTo(110);
    expect(after.food.dataQuality).toBe("complete");
    const portionBefore = before.servings.find((s) => s.unit === "serving")!;
    const portionAfter = after.servings.find((s) => s.unit === "serving")!;
    expect(portionAfter.id).toBe(portionBefore.id);
    expect(portionAfter.grams).toBeCloseTo(200);
    expect(after.servings).toHaveLength(2);

    const rows = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
    expect(rows).toHaveLength(1);
  });

  it("keeps an ingredient that was archived after it was added", async () => {
    const ctx = await createTestUser(db);
    const temp = await createTestFood(db, { name: "Saisonkürbis" });
    const { id } = await createRecipe(ctx, {
      ...base(),
      ingredients: [{ foodId: temp.id, servingId: null, quantity: 500 }],
    });
    await db.update(foods).set({ isArchived: true }).where(eq(foods.id, temp.id));
    await expect(
      updateRecipe(ctx, id, {
        ...base(),
        ingredients: [{ foodId: temp.id, servingId: null, quantity: 600 }],
      }),
    ).resolves.toMatchObject({ id });
  });

  it("rejects the recipe's own food as an ingredient", async () => {
    const ctx = await createTestUser(db);
    const { id, foodId } = await createRecipe(ctx, base());
    await expect(
      updateRecipe(ctx, id, { ...base(), ingredients: [{ foodId, servingId: null, quantity: 100 }] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("cannot touch another user's recipe", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    const { id } = await createRecipe(alice, base());
    await expect(updateRecipe(bob, id, base())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getRecipe(bob, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteRecipe(bob, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(duplicateRecipe(bob, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getRecipe(alice, "not-a-uuid")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("listRecipes", () => {
  it("lists only the user's recipes with per-portion nutrition and ingredient count", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    await createRecipe(alice, base());
    await createRecipe(alice, {
      ...base(),
      name: "Reis pur",
      servings: 2,
      ingredients: [{ foodId: rice.id, servingId: null, quantity: 200 }],
    });
    await createRecipe(bob, { ...base(), name: "Bobs Curry" });

    const list = await listRecipes(alice);
    expect(list.map((r) => r.name).sort()).toEqual(["Chicken Curry", "Reis pur"]);
    const curry = list.find((r) => r.name === "Chicken Curry")!;
    expect(curry.ingredientCount).toBe(3);
    expect(curry.servings).toBe(4);
    expect(curry.perServing!.kcal).toBeCloseTo(450);
    expect(curry.perServing!.proteinG).toBeCloseTo(42);
    expect(curry.servingGrams).toBeCloseTo(300);

    expect(await listRecipes(await createTestUser(db))).toEqual([]);
  });
});

describe("duplicateRecipe", () => {
  it("copies ingredients into a new recipe with its own linked food", async () => {
    const ctx = await createTestUser(db);
    const original = await createRecipe(ctx, base());
    const copy = await duplicateRecipe(ctx, original.id);
    expect(copy.id).not.toBe(original.id);
    expect(copy.foodId).not.toBe(original.foodId);
    const detail = await getRecipe(ctx, copy.id);
    expect(detail.name).toBe("Chicken Curry (Kopie)");
    expect(detail.ingredients.map((i) => i.foodId)).toEqual([chicken.id, rice.id, coconut.id]);
    expect(detail.ingredients[1].servingId).toBe(rice.servings.find((s) => s.isDefault)!.id);
    expect(detail.nutrition.perServing.kcal).toBeCloseTo(450);
  });
});

describe("deleteRecipe", () => {
  it("deletes the recipe, archives the linked food and keeps diary snapshots", async () => {
    const ctx = await createTestUser(db);
    const { id, foodId } = await createRecipe(ctx, base());
    const { food, servings } = await linkedFood(foodId);
    const entry = await createTestEntry(ctx, {
      mealId: ctx.mealIds.dinner,
      date: "2026-09-20",
      food: { ...food, servings },
      overrides: { recipeId: id },
    });
    expect(entry.kcal).toBeCloseTo(450);

    await deleteRecipe(ctx, id);

    expect(await db.select().from(recipes).where(eq(recipes.id, id))).toHaveLength(0);
    expect(await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, id))).toHaveLength(
      0,
    );
    const after = await linkedFood(foodId);
    expect(after.food.isArchived).toBe(true);

    const [kept] = await db.select().from(mealEntries).where(eq(mealEntries.id, entry.id));
    expect(kept.foodId).toBe(foodId);
    expect(kept.recipeId).toBeNull();
    expect(kept.kcal).toBeCloseTo(450);
    expect(kept.foodName).toBe("Chicken Curry");
  });

  it("keeps foods used as ingredients from being deleted", async () => {
    const ctx = await createTestUser(db);
    const own = await createTestUserFood(ctx, { name: "Eigene Brühe" });
    await createRecipe(ctx, { ...base(), ingredients: [{ foodId: own.id, servingId: null, quantity: 500 }] });
    await expect(
      db.delete(foods).where(and(eq(foods.id, own.id), eq(foods.ownerUserId, ctx.userId))),
    ).rejects.toThrow();
  });
});

describe("searchIngredientFoods", () => {
  it("finds public foods and own foods/recipes with servings, not other users' private foods", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    await createTestUserFood(alice, { name: "Kokosjoghurt Alice" });
    const bobs = await createTestUserFood(bob, { name: "Kokosjoghurt Bob" });

    const results = await searchIngredientFoods(alice, { query: "kokos" });
    const names = results.map((r) => r.name);
    expect(names).toContain("Kokosmilch");
    expect(names).toContain("Kokosjoghurt Alice");
    expect(results.map((r) => r.id)).not.toContain(bobs.id);
    const coco = results.find((r) => r.name === "Kokosmilch")!;
    expect(coco.servings.length).toBeGreaterThan(0);
    expect(coco.per100.fatG).toBeCloseTo(11.45);

    expect(await searchIngredientFoods(alice, { query: "   " })).toEqual([]);
  });

  it("excludes the given food and archived recipe foods", async () => {
    const ctx = await createTestUser(db);
    const { id, foodId } = await createRecipe(ctx, { ...base(), name: "Linsen-Dal Spezial" });
    const found = await searchIngredientFoods(ctx, { query: "linsen dal" });
    expect(found.map((f) => f.id)).toContain(foodId);
    const excluded = await searchIngredientFoods(ctx, { query: "linsen dal", excludeFoodId: foodId });
    expect(excluded.map((f) => f.id)).not.toContain(foodId);
    await deleteRecipe(ctx, id);
    const afterDelete = await searchIngredientFoods(ctx, { query: "linsen dal" });
    expect(afterDelete.map((f) => f.id)).not.toContain(foodId);
  });
});
