import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import {
  aggregateRecipe,
  isRecipeInputError,
  RecipeIdSchema,
  RecipeInputSchema,
  type RecipeAggregate,
  type RecipeInput,
  type RecipeInputRaw,
} from "@/domain/recipes";
import { formatNumber, NBSP } from "@/lib/format";
import { AppError, notFound, validationError, type FieldErrors } from "@/lib/errors";
import type { z } from "@/lib/zod";
import { inTransaction, type ServiceContext } from "@/server/context";
import { foods, foodServings, recipeIngredients, recipes } from "@/server/db/schema";
import { loadVisibleFoods, toIngredientFoodOption, type IngredientFoodOption } from "./foods";
import { RECIPE_PORTION_UNIT, upsertRecipeFood } from "./recipe-food";

export type { RecipeInput, RecipeInputRaw } from "@/domain/recipes";

/** One ingredient of a recipe, with its food (name, servings, nutrients) for display and editing. */
export interface RecipeIngredientView {
  id: string;
  foodId: string;
  servingId: string | null;
  /** Label of the chosen serving ("1 Scheibe"), or "g"/"ml" when entered in base units. */
  servingLabel: string;
  quantity: number;
  /** Base units (g/ml) of this ingredient. */
  grams: number;
  /** Human readable amount: "2 × 1 Scheibe (30 g)" / "250 g". */
  amountLabel: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  food: IngredientFoodOption;
}

export interface RecipeDetail {
  id: string;
  name: string;
  description: string | null;
  servings: number;
  /** Stored cooked weight (null = raw weight is used). */
  totalWeightG: number | null;
  /** Linked food (log / favorite this). */
  foodId: string | null;
  /** Default "1 Portion" serving of the linked food. */
  portionServingId: string | null;
  createdAt: Date;
  updatedAt: Date;
  ingredients: RecipeIngredientView[];
  nutrition: RecipeAggregate;
}

export interface RecipeListItem {
  id: string;
  name: string;
  description: string | null;
  servings: number;
  ingredientCount: number;
  foodId: string | null;
  /** Grams of one portion (null when the linked food is missing). */
  servingGrams: number | null;
  perServing: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------------------------

function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

function parseInput(input: RecipeInputRaw): RecipeInput {
  const parsed = RecipeInputSchema.safeParse(input);
  if (!parsed.success) throw validationError(toFieldErrors(parsed.error));
  return parsed.data;
}

function parseId(id: string): string {
  const parsed = RecipeIdSchema.safeParse({ id });
  if (!parsed.success) throw notFound("Rezept");
  return parsed.data.id;
}

const unitOf = (food: IngredientFoodOption) => food.basis;

function amountLabel(
  food: IngredientFoodOption,
  servingLabel: string | null,
  quantity: number,
  grams: number,
) {
  const unit = unitOf(food);
  const g = `${formatNumber(grams, { maxFractionDigits: grams < 10 ? 1 : 0 })}${NBSP}${unit}`;
  if (!servingLabel) return g;
  const q = formatNumber(quantity, { maxFractionDigits: 2 });
  return `${q} × ${servingLabel} · ${g}`;
}

interface ResolvedIngredient {
  foodId: string;
  servingId: string | null;
  servingLabel: string | null;
  quantity: number;
  grams: number;
  food: IngredientFoodOption;
}

/**
 * Validates ingredient foods/servings against what the user may see and derives grams.
 * Archived foods are only allowed if they're in `allowArchived` (already part of the recipe).
 */
async function resolveIngredients(
  ctx: ServiceContext,
  input: RecipeInput,
  opts: { allowArchived?: ReadonlySet<string>; ownFoodId?: string | null } = {},
): Promise<ResolvedIngredient[]> {
  const byId = await loadVisibleFoods(
    ctx.db,
    ctx.userId,
    input.ingredients.map((i) => i.foodId),
  );
  const errors: FieldErrors = {};
  const resolved: ResolvedIngredient[] = [];

  input.ingredients.forEach((ing, idx) => {
    const food = byId.get(ing.foodId);
    const key = `ingredients.${idx}.foodId`;
    if (!food) {
      errors[key] = ["Dieses Lebensmittel gibt es nicht (mehr)."];
      return;
    }
    if (opts.ownFoodId && food.id === opts.ownFoodId) {
      errors[key] = ["Ein Rezept kann sich nicht selbst als Zutat enthalten."];
      return;
    }
    if (food.isArchived && !opts.allowArchived?.has(food.id)) {
      errors[key] = ["Dieses Lebensmittel ist archiviert und kann nicht neu hinzugefügt werden."];
      return;
    }
    let grams = ing.quantity;
    let servingLabel: string | null = null;
    if (ing.servingId) {
      const serving = food.servings.find((s) => s.id === ing.servingId);
      if (!serving) {
        errors[`ingredients.${idx}.servingId`] = ["Diese Portion gehört nicht zum Lebensmittel."];
        return;
      }
      grams = serving.grams * ing.quantity;
      servingLabel = serving.label;
    }
    resolved.push({
      foodId: food.id,
      servingId: ing.servingId,
      servingLabel,
      quantity: ing.quantity,
      grams,
      food,
    });
  });

  if (Object.keys(errors).length > 0) {
    throw validationError(errors, "Bitte prüfe die Zutaten.");
  }
  return resolved;
}

function aggregate(input: Pick<RecipeInput, "servings" | "totalWeightG">, ingredients: ResolvedIngredient[]) {
  try {
    return aggregateRecipe({
      servings: input.servings,
      totalWeightG: input.totalWeightG,
      ingredients: ingredients.map((i) => ({
        per100: i.food.per100,
        grams: i.grams,
        basis: i.food.basis,
        densityGPerMl: i.food.densityGPerMl,
      })),
    });
  } catch (err) {
    if (isRecipeInputError(err)) throw validationError({ [err.field]: [err.message] }, err.message);
    throw err;
  }
}

/** Rejects dishes whose per-100 g values would be physically implausible (foods-table CHECKs). */
function assertPlausible(agg: RecipeAggregate) {
  // Small tolerance for float noise.
  if (agg.totalWeightG + 1e-6 >= agg.minTotalWeightG) return;
  const min = `${formatNumber(Math.ceil(agg.minTotalWeightG))}${NBSP}g`;
  if (agg.hasCookedWeight) {
    const message = `Das Gewicht nach dem Kochen ist zu niedrig – bei diesen Zutaten mindestens ${min}.`;
    throw validationError({ totalWeightG: [message] }, message);
  }
  const message = `Die Nährwerte pro 100 g wären unplausibel hoch. Bitte gib das Gewicht nach dem Kochen an (mindestens ${min}).`;
  throw validationError({ totalWeightG: [message] }, message);
}

async function insertIngredients(ctx: ServiceContext, recipeId: string, ingredients: ResolvedIngredient[]) {
  await ctx.db.insert(recipeIngredients).values(
    ingredients.map((i, idx) => ({
      recipeId,
      foodId: i.foodId,
      servingId: i.servingId,
      quantity: i.quantity,
      grams: i.grams,
      sortOrder: idx,
    })),
  );
}

async function findOwnRecipe(ctx: ServiceContext, id: string) {
  const [row] = await ctx.db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, ctx.userId)))
    .limit(1);
  if (!row) throw notFound("Rezept");
  return row;
}

async function createFromInput(
  ctx: ServiceContext,
  data: RecipeInput,
  allowArchived?: ReadonlySet<string>,
): Promise<{ id: string; foodId: string }> {
  return inTransaction(ctx, async (tx) => {
    const ingredients = await resolveIngredients(tx, data, { allowArchived });
    const agg = aggregate(data, ingredients);
    assertPlausible(agg);
    const [recipe] = await tx.db
      .insert(recipes)
      .values({
        userId: tx.userId,
        name: data.name,
        description: data.description,
        servings: data.servings,
        totalWeightG: data.totalWeightG,
      })
      .returning({ id: recipes.id, name: recipes.name, foodId: recipes.foodId });
    await insertIngredients(tx, recipe.id, ingredients);
    const foodId = await upsertRecipeFood(tx.db, tx.userId, recipe, agg);
    return { id: recipe.id, foodId };
  });
}

// ---------------------------------------------------------------------------------------------

/**
 * Creates a recipe with its ingredients and linked food (one transaction).
 * Throws AppError VALIDATION (German fieldErrors, e.g. "ingredients.0.foodId") for invalid input,
 * foods the user can't see, archived foods or implausible cooked weights.
 */
export async function createRecipe(
  ctx: ServiceContext,
  input: RecipeInputRaw,
): Promise<{ id: string; foodId: string }> {
  return createFromInput(ctx, parseInput(input));
}

/**
 * Replaces name, description, servings, cooked weight and ALL ingredients of the user's recipe
 * and re-syncs the linked food. Diary entries logged earlier keep their nutrient snapshots.
 */
export async function updateRecipe(
  ctx: ServiceContext,
  id: string,
  input: RecipeInputRaw,
): Promise<{ id: string; foodId: string }> {
  const recipeId = parseId(id);
  const data = parseInput(input);
  return inTransaction(ctx, async (tx) => {
    const existing = await findOwnRecipe(tx, recipeId);
    const current = await tx.db
      .select({ foodId: recipeIngredients.foodId })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipeId));
    const ingredients = await resolveIngredients(tx, data, {
      allowArchived: new Set(current.map((c) => c.foodId)),
      ownFoodId: existing.foodId,
    });
    const agg = aggregate(data, ingredients);
    assertPlausible(agg);

    const [recipe] = await tx.db
      .update(recipes)
      .set({
        name: data.name,
        description: data.description,
        servings: data.servings,
        totalWeightG: data.totalWeightG,
      })
      .where(and(eq(recipes.id, recipeId), eq(recipes.userId, tx.userId)))
      .returning({ id: recipes.id, name: recipes.name, foodId: recipes.foodId });

    await tx.db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
    await insertIngredients(tx, recipeId, ingredients);
    const foodId = await upsertRecipeFood(tx.db, tx.userId, recipe, agg);
    return { id: recipeId, foodId };
  });
}

/** The user's recipe with ingredients (food names, serving labels) and computed nutrition. */
export async function getRecipe(ctx: ServiceContext, id: string): Promise<RecipeDetail> {
  const recipeId = parseId(id);
  const recipe = await findOwnRecipe(ctx, recipeId);
  const rows = await ctx.db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.sortOrder), asc(recipeIngredients.createdAt));

  // Ingredients reference foods by FK, so they always exist. Visibility can only be lost if a
  // formerly public food became private – then the ingredient is still shown (it's the user's data).
  const byId = await loadVisibleFoods(
    ctx.db,
    ctx.userId,
    rows.map((r) => r.foodId),
  );
  const missing = rows.filter((r) => !byId.has(r.foodId)).map((r) => r.foodId);
  if (missing.length > 0) {
    const extra = await ctx.db.query.foods.findMany({
      where: (f, { inArray }) => inArray(f.id, missing),
      with: { servings: true },
    });
    for (const f of extra) byId.set(f.id, toIngredientFoodOption(f));
  }

  const ingredients: RecipeIngredientView[] = [];
  const resolved: ResolvedIngredient[] = [];
  for (const r of rows) {
    const food = byId.get(r.foodId);
    if (!food) continue;
    const serving = r.servingId ? food.servings.find((s) => s.id === r.servingId) : undefined;
    const servingLabel = serving?.label ?? null;
    const f = r.grams / 100;
    ingredients.push({
      id: r.id,
      foodId: r.foodId,
      servingId: serving ? r.servingId : null,
      servingLabel: servingLabel ?? food.basis,
      quantity: serving ? r.quantity : r.grams,
      grams: r.grams,
      amountLabel: amountLabel(food, servingLabel, r.quantity, r.grams),
      kcal: food.per100.kcal * f,
      proteinG: food.per100.proteinG * f,
      carbsG: food.per100.carbsG * f,
      fatG: food.per100.fatG * f,
      food,
    });
    resolved.push({
      foodId: r.foodId,
      servingId: r.servingId,
      servingLabel,
      quantity: r.quantity,
      grams: r.grams,
      food,
    });
  }

  let portionServingId: string | null = null;
  if (recipe.foodId) {
    const [portion] = await ctx.db
      .select({ id: foodServings.id })
      .from(foodServings)
      .where(and(eq(foodServings.foodId, recipe.foodId), eq(foodServings.unit, RECIPE_PORTION_UNIT)))
      .limit(1);
    portionServingId = portion?.id ?? null;
  }

  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    servings: recipe.servings,
    totalWeightG: recipe.totalWeightG,
    foodId: recipe.foodId,
    portionServingId,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    ingredients,
    nutrition: aggregate(recipe, resolved),
  };
}

/** The user's recipes, most recently edited first, with per-portion nutrition from the linked food. */
export async function listRecipes(ctx: ServiceContext): Promise<RecipeListItem[]> {
  const ingredientCounts = ctx.db
    .select({ recipeId: recipeIngredients.recipeId, n: count().as("n") })
    .from(recipeIngredients)
    .groupBy(recipeIngredients.recipeId)
    .as("ic");

  const rows = await ctx.db
    .select({
      id: recipes.id,
      name: recipes.name,
      description: recipes.description,
      servings: recipes.servings,
      foodId: recipes.foodId,
      updatedAt: recipes.updatedAt,
      ingredientCount: sql<number>`coalesce(${ingredientCounts.n}, 0)`.mapWith(Number),
      kcal: foods.kcal,
      proteinG: foods.proteinG,
      carbsG: foods.carbsG,
      fatG: foods.fatG,
      servingGrams: foodServings.grams,
    })
    .from(recipes)
    .leftJoin(ingredientCounts, eq(ingredientCounts.recipeId, recipes.id))
    .leftJoin(foods, eq(foods.id, recipes.foodId))
    .leftJoin(
      foodServings,
      and(eq(foodServings.foodId, recipes.foodId), eq(foodServings.unit, RECIPE_PORTION_UNIT)),
    )
    .where(eq(recipes.userId, ctx.userId))
    .orderBy(desc(recipes.updatedAt), asc(recipes.name));

  return rows.map((r) => {
    const hasFood = r.kcal != null && r.servingGrams != null;
    const f = hasFood ? r.servingGrams! / 100 : 0;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      servings: r.servings,
      ingredientCount: r.ingredientCount,
      foodId: r.foodId,
      servingGrams: r.servingGrams,
      perServing: hasFood
        ? {
            kcal: r.kcal! * f,
            proteinG: r.proteinG! * f,
            carbsG: r.carbsG! * f,
            fatG: r.fatG! * f,
          }
        : null,
      updatedAt: r.updatedAt,
    };
  });
}

/** Copies the user's recipe (name + " (Kopie)") incl. ingredients and a new linked food. */
export async function duplicateRecipe(
  ctx: ServiceContext,
  id: string,
): Promise<{ id: string; foodId: string }> {
  const source = await getRecipe(ctx, id);
  if (source.ingredients.length === 0) {
    throw new AppError("VALIDATION", "Dieses Rezept hat keine Zutaten und kann nicht kopiert werden.");
  }
  const suffix = " (Kopie)";
  const name = source.name.slice(0, 80 - suffix.length) + suffix;
  const data = parseInput({
    name,
    description: source.description,
    servings: source.servings,
    totalWeightG: source.totalWeightG,
    ingredients: source.ingredients.map((i) => ({
      foodId: i.foodId,
      servingId: i.servingId,
      quantity: i.quantity,
    })),
  });
  return createFromInput(ctx, data, new Set(source.ingredients.map((i) => i.foodId)));
}

/**
 * Deletes the user's recipe and its ingredients. The linked food is ARCHIVED (not deleted):
 * diary entries keep their snapshot and food reference, other recipes using it keep working.
 * meal_entries.recipe_id is set null by the FK.
 */
export async function deleteRecipe(ctx: ServiceContext, id: string): Promise<{ id: string }> {
  const recipeId = parseId(id);
  return inTransaction(ctx, async (tx) => {
    const recipe = await findOwnRecipe(tx, recipeId);
    await tx.db
      .update(foods)
      .set({ isArchived: true })
      .where(
        and(
          eq(foods.ownerUserId, tx.userId),
          eq(foods.source, "recipe"),
          recipe.foodId ? eq(foods.id, recipe.foodId) : eq(foods.sourceId, recipe.id),
        ),
      );
    await tx.db.delete(recipes).where(and(eq(recipes.id, recipeId), eq(recipes.userId, tx.userId)));
    return { id: recipeId };
  });
}
