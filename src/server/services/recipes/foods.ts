import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import type { RecipeNutrients } from "@/domain/recipes";
import type { NutrientBasis } from "@/domain/nutrition/types";
import type { ServiceContext } from "@/server/context";
import type { DbOrTx } from "@/server/db/create";
import { searchFoodsReference } from "@/server/db/food-search-sql";
import { foods } from "@/server/db/schema";

/** A serving the user can pick for an ingredient. `grams` = base units (g/ml) of one serving. */
export interface IngredientServingOption {
  id: string;
  label: string;
  grams: number;
  isDefault: boolean;
}

/** Everything the builder needs about a food to use it as an ingredient (serializable). */
export interface IngredientFoodOption {
  id: string;
  name: string;
  brandName: string | null;
  source: "usda" | "off" | "curated" | "user" | "recipe";
  basis: NutrientBasis;
  densityGPerMl: number | null;
  isArchived: boolean;
  /** Nutrients per 100 units of `basis`. */
  per100: RecipeNutrients;
  servings: IngredientServingOption[];
}

type FoodWithServings = typeof foods.$inferSelect & {
  servings: { id: string; label: string; grams: number; isDefault: boolean; sortOrder: number }[];
};

export function toIngredientFoodOption(f: FoodWithServings): IngredientFoodOption {
  return {
    id: f.id,
    name: f.name,
    brandName: f.brandName,
    source: f.source,
    basis: f.nutrientBasis,
    densityGPerMl: f.densityGPerMl,
    isArchived: f.isArchived,
    per100: {
      kcal: f.kcal,
      proteinG: f.proteinG,
      carbsG: f.carbsG,
      fatG: f.fatG,
      fiberG: f.fiberG,
      sugarG: f.sugarG,
      saturatedFatG: f.saturatedFatG,
      saltG: f.saltG,
      sodiumMg: f.sodiumMg,
      potassiumMg: f.potassiumMg,
      calciumMg: f.calciumMg,
      ironMg: f.ironMg,
    },
    servings: [...f.servings]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ id: s.id, label: s.label, grams: s.grams, isDefault: s.isDefault })),
  };
}

/**
 * Loads foods (with servings) that `userId` may use as ingredients: public foods and the user's
 * own foods/recipes. Other users' private foods are silently excluded (callers treat missing ids
 * as "not found"). Archived foods are included: callers decide whether they're allowed.
 */
export async function loadVisibleFoods(
  db: DbOrTx,
  userId: string,
  foodIds: readonly string[],
): Promise<Map<string, IngredientFoodOption>> {
  const ids = [...new Set(foodIds)];
  if (ids.length === 0) return new Map();
  const rows = await db.query.foods.findMany({
    where: and(inArray(foods.id, ids), or(eq(foods.visibility, "public"), eq(foods.ownerUserId, userId))),
    with: { servings: true },
  });
  return new Map(rows.map((r) => [r.id, toIngredientFoodOption(r)]));
}

export interface SearchIngredientFoodsInput {
  query: string;
  limit?: number;
  /** Exclude this food (the recipe's own linked food when editing). */
  excludeFoodId?: string | null;
}

/**
 * Ingredient search for the recipe builder: public foods + the user's own foods and recipes,
 * ranked by the reference search (searchFoodsReference), with full nutrients and servings so
 * the picker needs no second round trip. Food Search's search service can replace the ranking later.
 */
export async function searchIngredientFoods(
  ctx: ServiceContext,
  input: SearchIngredientFoodsInput,
): Promise<IngredientFoodOption[]> {
  const query = input.query.trim();
  if (!query) return [];
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const hits = await searchFoodsReference(ctx.db, { query, userId: ctx.userId, limit: limit + 1 });
  const ids = hits.map((h) => h.id).filter((id) => id !== input.excludeFoodId);
  const byId = await loadVisibleFoods(ctx.db, ctx.userId, ids);
  return ids
    .map((id) => byId.get(id))
    .filter((f): f is IngredientFoodOption => !!f && !f.isArchived)
    .slice(0, limit);
}
