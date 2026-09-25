import { doublePrecision, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
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
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("recipes_user_idx").on(t.userId)],
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
    servingId: uuid("serving_id").references(() => foodServings.id, { onDelete: "set null" }),
    quantity: doublePrecision("quantity").notNull(),
    /** Total base units (g/ml) of this ingredient. */
    grams: doublePrecision("grams").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("recipe_ingredients_recipe_idx").on(t.recipeId)],
);
