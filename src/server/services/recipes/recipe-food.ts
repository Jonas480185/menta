import "server-only";
import { and, eq } from "drizzle-orm";
import { normalizeFoodText } from "@/domain/food/normalize";
import { recipePortionLabel, type RecipeAggregate } from "@/domain/recipes";
import type { DbOrTx } from "@/server/db/create";
import { foods, foodServings, recipes } from "@/server/db/schema";

/** Unit codes of the two servings every recipe food carries. */
export const RECIPE_PORTION_UNIT = "serving";
export const RECIPE_BASE_UNIT = "g";

/**
 * Creates or updates the private `foods` row linked to a recipe (source "recipe",
 * sourceId = recipe id) so the recipe can be searched, favorited and logged like a food:
 * per-100 g nutrients from `aggregate.per100g` and two servings – "1 Portion (≈ N g)" (default)
 * and "100 g". Servings are updated in place so their ids (used by food_usage/meal entries) stay
 * stable. Un-archives the food and sets `recipes.food_id` when needed. Run inside the recipe's
 * transaction. Returns the food id.
 */
export async function upsertRecipeFood(
  tx: DbOrTx,
  userId: string,
  recipe: { id: string; name: string; foodId: string | null },
  aggregate: RecipeAggregate,
): Promise<string> {
  const p = aggregate.per100g;
  const values = {
    name: recipe.name,
    nameNormalized: normalizeFoodText(recipe.name) || "rezept",
    nutrientBasis: "g" as const,
    densityGPerMl: null,
    kcal: p.kcal,
    proteinG: p.proteinG,
    carbsG: p.carbsG,
    fatG: p.fatG,
    fiberG: p.fiberG,
    sugarG: p.sugarG,
    saturatedFatG: p.saturatedFatG,
    saltG: p.saltG,
    sodiumMg: p.sodiumMg,
    potassiumMg: p.potassiumMg,
    calciumMg: p.calciumMg,
    ironMg: p.ironMg,
    dataQuality: aggregate.incomplete.length > 0 ? ("partial" as const) : ("complete" as const),
    isArchived: false,
  };

  // Linked food: by recipes.food_id, else by (source, source_id) in case the link was lost.
  const [existing] = await tx
    .select({ id: foods.id })
    .from(foods)
    .where(
      and(
        eq(foods.ownerUserId, userId),
        eq(foods.source, "recipe"),
        recipe.foodId ? eq(foods.id, recipe.foodId) : eq(foods.sourceId, recipe.id),
      ),
    )
    .limit(1);

  let foodId: string;
  if (existing) {
    foodId = existing.id;
    await tx
      .update(foods)
      .set({ ...values, sourceId: recipe.id })
      .where(eq(foods.id, foodId));
  } else {
    const [row] = await tx
      .insert(foods)
      .values({
        ...values,
        source: "recipe",
        sourceId: recipe.id,
        ownerUserId: userId,
        visibility: "private",
      })
      .returning({ id: foods.id });
    foodId = row.id;
  }

  await syncServings(tx, foodId, aggregate.servingGrams);

  if (recipe.foodId !== foodId) {
    await tx
      .update(recipes)
      .set({ foodId })
      .where(and(eq(recipes.id, recipe.id), eq(recipes.userId, userId)));
  }
  return foodId;
}

async function syncServings(tx: DbOrTx, foodId: string, servingGrams: number) {
  const current = await tx
    .select({ id: foodServings.id, unit: foodServings.unit, grams: foodServings.grams })
    .from(foodServings)
    .where(eq(foodServings.foodId, foodId));

  const portion = {
    label: recipePortionLabel(servingGrams),
    amount: 1,
    unit: RECIPE_PORTION_UNIT,
    grams: servingGrams,
    isDefault: true,
    sortOrder: 0,
  };
  const base = {
    label: "100 g",
    amount: 100,
    unit: RECIPE_BASE_UNIT,
    grams: 100,
    isDefault: false,
    sortOrder: 1,
  };

  const currentPortion = current.find((s) => s.unit === RECIPE_PORTION_UNIT);
  if (currentPortion) {
    await tx.update(foodServings).set(portion).where(eq(foodServings.id, currentPortion.id));
  } else {
    await tx.insert(foodServings).values({ ...portion, foodId });
  }

  const currentBase = current.find((s) => s.unit === RECIPE_BASE_UNIT && s.grams === 100);
  if (currentBase) {
    await tx.update(foodServings).set(base).where(eq(foodServings.id, currentBase.id));
  } else {
    await tx.insert(foodServings).values({ ...base, foodId });
  }
}
