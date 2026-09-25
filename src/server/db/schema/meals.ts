import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { user } from "./auth";
import { foods, foodServings } from "./foods";
import { recipes } from "./recipes";

/**
 * User-configurable meal slots (Meal). Defaults created at signup:
 * Frühstück, Mittagessen, Abendessen, Snacks.
 * Slots are archived, never hard-deleted, so historic entries stay intact.
 * Owner: Meal Logging, configured via Settings.
 */
export const meals = pgTable(
  "meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Optional lucide icon name / emoji-free key, e.g. "sunrise". */
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** "HH:MM" – used to preselect the meal when logging. */
    defaultTime: text("default_time"),
    isArchived: boolean("is_archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("meals_user_idx").on(t.userId)],
);

/**
 * A logged food (MealEntry).
 *
 * Nutrient values are a SNAPSHOT computed at log time (and recomputed when the entry's
 * amount changes). Rationale: foods from external providers get refreshed and user foods
 * can be edited – historic diaries must not silently change. Daily totals are aggregated
 * from these rows on read (see Daily Nutrition Engine) and are never stored separately.
 *
 * Owner: Meal Logging.
 */
export const mealEntries = pgTable(
  "meal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "restrict" }),
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    /** Set when the logged food is a recipe (foods.source = recipe). */
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    servingId: uuid("serving_id").references(() => foodServings.id, { onDelete: "set null" }),

    /** Snapshots for display even if the food is deleted later. */
    foodName: text("food_name").notNull(),
    brandName: text("brand_name"),
    servingLabel: text("serving_label").notNull(),
    /** Base units (g/ml) of ONE serving at log time. */
    servingGrams: doublePrecision("serving_grams").notNull(),
    /** Number of servings, e.g. 1.5 */
    quantity: doublePrecision("quantity").notNull(),
    /** Total base units = servingGrams * quantity. */
    grams: doublePrecision("grams").notNull(),

    kcal: doublePrecision("kcal").notNull(),
    proteinG: doublePrecision("protein_g").notNull(),
    carbsG: doublePrecision("carbs_g").notNull(),
    fatG: doublePrecision("fat_g").notNull(),
    fiberG: doublePrecision("fiber_g"),
    sugarG: doublePrecision("sugar_g"),
    saturatedFatG: doublePrecision("saturated_fat_g"),
    sodiumMg: doublePrecision("sodium_mg"),

    sortOrder: integer("sort_order").notNull().default(0),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    index("meal_entries_user_date_idx").on(t.userId, t.date),
    index("meal_entries_user_food_idx").on(t.userId, t.foodId),
    index("meal_entries_meal_idx").on(t.mealId),
  ],
);
