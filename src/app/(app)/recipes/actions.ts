"use server";

import { revalidatePath } from "next/cache";
import { RecipeIdSchema, RecipeInputSchema } from "@/domain/recipes";
import { runAction, type ActionResult } from "@/lib/result";
import { z } from "@/lib/zod";
import { getServiceContext } from "@/server/auth/context";
import {
  createRecipe,
  deleteRecipe,
  duplicateRecipe,
  searchIngredientFoods,
  updateRecipe,
  type IngredientFoodOption,
} from "@/server/services/recipes";

type RecipeRef = { id: string; foodId: string };

/** Recipe foods show up in search, favorites and "Meine" – refresh those surfaces too. */
function revalidateRecipes(id?: string) {
  revalidatePath("/recipes");
  if (id) revalidatePath(`/recipes/${id}`);
  revalidatePath("/foods");
  revalidatePath("/log", "layout");
}

export async function createRecipeAction(input: unknown): Promise<ActionResult<RecipeRef>> {
  return runAction(async () => {
    const data = RecipeInputSchema.parse(input);
    const ctx = await getServiceContext();
    const result = await createRecipe(ctx, data);
    revalidateRecipes(result.id);
    return result;
  });
}

const UpdateSchema = z.object({ id: z.uuid("Ungültiges Rezept."), recipe: RecipeInputSchema });

export async function updateRecipeAction(input: unknown): Promise<ActionResult<RecipeRef>> {
  return runAction(async () => {
    const { id, recipe } = UpdateSchema.parse(input);
    const ctx = await getServiceContext();
    const result = await updateRecipe(ctx, id, recipe);
    revalidateRecipes(id);
    return result;
  });
}

export async function duplicateRecipeAction(input: unknown): Promise<ActionResult<RecipeRef>> {
  return runAction(async () => {
    const { id } = RecipeIdSchema.parse(input);
    const ctx = await getServiceContext();
    const result = await duplicateRecipe(ctx, id);
    revalidateRecipes(result.id);
    return result;
  });
}

export async function deleteRecipeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { id } = RecipeIdSchema.parse(input);
    const ctx = await getServiceContext();
    const result = await deleteRecipe(ctx, id);
    revalidateRecipes(id);
    return result;
  });
}

const SearchSchema = z.object({
  query: z.string().trim().max(100),
  excludeFoodId: z.uuid().nullish(),
});

/** Ingredient search for the recipe builder (read-only, no revalidation). */
export async function searchIngredientFoodsAction(
  input: unknown,
): Promise<ActionResult<IngredientFoodOption[]>> {
  return runAction(async () => {
    const { query, excludeFoodId } = SearchSchema.parse(input);
    const ctx = await getServiceContext();
    return searchIngredientFoods(ctx, { query, excludeFoodId, limit: 20 });
  });
}
