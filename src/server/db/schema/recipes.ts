import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { user } from "./auth";
import { foods, foodServings } from "./foods";

/**
 * Recipe. Each recipe owns a linked `foods` row (source = recipe, visibility = private)
 * whose per-100 g nutrients are derived from the ingredients and total weight, plus a
 * "1 Portion" serving (= totalWeightG / servings). This lets search, favorites, recents
 * and logging treat recipes exactly like foods.
 *
 * Owner: Recipes.
 */
export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    servings: doublePrecision("servings").notNull().default(1),
    /** Cooked total weight. Null → sum of ingredient grams (no water loss). */
    totalWeightG: doublePrecision("total_weight_g"),
    foodId: uuid("food_id").references(() => foods.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("recipes_user_idx").on(t.userId),
    /** 1:1 recipe ↔ linked food row; also serves "which recipe is this food?". */
    uniqueIndex("recipes_food_uq")
      .on(t.foodId)
      .where(sql`${t.foodId} is not null`),
    check("recipes_servings_positive", sql`${t.servings} > 0`),
    check(
      "recipes_total_weight_positive",
      sql`${t.totalWeightG} is null or ${t.totalWeightG} > 0`,
    ),
    check("recipes_name_not_blank", sql`length(trim(${t.name})) > 0`),
  ],
);

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "restrict" }),
    servingId: uuid("serving_id").references(() => foodServings.id, {
      onDelete: "set null",
    }),
    quantity: doublePrecision("quantity").notNull(),
    /** Total base units (g/ml) of this ingredient. */
    grams: doublePrecision("grams").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("recipe_ingredients_recipe_idx").on(t.recipeId, t.sortOrder),
    /** FK support: the RESTRICT check when deleting a food ("is it used in a recipe?"). */
    index("recipe_ingredients_food_idx").on(t.foodId),
    index("recipe_ingredients_serving_idx")
      .on(t.servingId)
      .where(sql`${t.servingId} is not null`),
    check("recipe_ingredients_quantity_positive", sql`${t.quantity} > 0`),
    check("recipe_ingredients_grams_positive", sql`${t.grams} > 0`),
  ],
);
