import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
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
  (t) => [
    index("meals_user_idx").on(t.userId, t.sortOrder),
    /** Target of the composite FK meal_entries(meal_id, user_id) – an entry can only live in its owner's meal. */
    unique("meals_id_user_uq").on(t.id, t.userId),
    check(
      "meals_default_time_format",
      sql`${t.defaultTime} is null or ${t.defaultTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
  ],
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
    /**
     * RESTRICT: meal slots are archived, never deleted while they hold entries.
     * Enforced by the composite FK `meal_entries_meal_owner_fk` (meal_id, user_id) below,
     * which additionally guarantees the meal belongs to the same user.
     */
    mealId: uuid("meal_id").notNull(),
    foodId: uuid("food_id").references(() => foods.id, {
      onDelete: "set null",
    }),
    /** Set when the logged food is a recipe (foods.source = recipe). */
    recipeId: uuid("recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    servingId: uuid("serving_id").references(() => foodServings.id, {
      onDelete: "set null",
    }),

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
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (t) => [
    /** Diary of a day, daily totals, analytics ranges (user_id = ? AND date BETWEEN ? AND ?). */
    index("meal_entries_user_date_idx").on(t.userId, t.date),
    /** "How often/when did I eat X" + food-usage backfill. */
    index("meal_entries_user_food_idx").on(t.userId, t.foodId),
    index("meal_entries_meal_idx").on(t.mealId),
    /** FK support: deleting a food / serving / recipe sets these to null without a full scan. */
    index("meal_entries_food_idx")
      .on(t.foodId)
      .where(sql`${t.foodId} is not null`),
    index("meal_entries_serving_idx")
      .on(t.servingId)
      .where(sql`${t.servingId} is not null`),
    index("meal_entries_recipe_idx")
      .on(t.recipeId)
      .where(sql`${t.recipeId} is not null`),
    foreignKey({
      name: "meal_entries_meal_owner_fk",
      columns: [t.mealId, t.userId],
      foreignColumns: [meals.id, meals.userId],
    }).onDelete("restrict"),
    check("meal_entries_quantity_positive", sql`${t.quantity} > 0`),
    check(
      "meal_entries_grams_non_negative",
      sql`${t.grams} >= 0 and ${t.servingGrams} >= 0`,
    ),
    check(
      "meal_entries_nutrients_non_negative",
      sql`${t.kcal} >= 0 and ${t.proteinG} >= 0 and ${t.carbsG} >= 0 and ${t.fatG} >= 0
        and coalesce(${t.fiberG}, 0) >= 0 and coalesce(${t.sugarG}, 0) >= 0
        and coalesce(${t.saturatedFatG}, 0) >= 0 and coalesce(${t.sodiumMg}, 0) >= 0`,
    ),
    check(
      "meal_entries_food_name_not_blank",
      sql`length(trim(${t.foodName})) > 0`,
    ),
  ],
);
