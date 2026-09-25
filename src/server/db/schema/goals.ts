import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { user } from "./auth";

export const goalProfileKindEnum = pgEnum("goal_profile_kind", [
  "default",
  "training",
  "rest",
  "high_carb",
  "low_carb",
  "refeed",
  "custom",
]);
export const macroModeEnum = pgEnum("macro_mode", ["percent", "grams", "auto"]);
export const calorieSourceEnum = pgEnum("calorie_source", [
  "calculated",
  "manual",
]);

/**
 * A "day profile" with full nutrition targets (NutritionGoal).
 * Every user has exactly one `isDefault` profile; others (Training Day, Rest Day, ...)
 * are optional and can be scheduled per weekday or assigned per date via daily_nutrition.
 *
 * Invariant (enforced by the Macro Engine):
 *   calorieTarget ≈ proteinG*4 + carbsG*4 + fatG*9  (± rounding)
 *
 * Owner: Macro Engine + Calorie Engine.
 */
export const goalProfiles = pgTable(
  "goal_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: goalProfileKindEnum("kind").notNull().default("default"),
    isDefault: boolean("is_default").notNull().default(false),
    /** ISO weekdays 1 (Mon) … 7 (Sun) on which this profile applies automatically. */
    weekdays: smallint("weekdays")
      .array()
      .notNull()
      .default(sql`'{}'::smallint[]`),
    calorieTarget: integer("calorie_target").notNull(),
    calorieSource: calorieSourceEnum("calorie_source")
      .notNull()
      .default("calculated"),
    macroMode: macroModeEnum("macro_mode").notNull().default("auto"),
    proteinG: doublePrecision("protein_g").notNull(),
    carbsG: doublePrecision("carbs_g").notNull(),
    fatG: doublePrecision("fat_g").notNull(),
    /** Only set when macroMode = percent (0–100, sum = 100). */
    proteinPct: doublePrecision("protein_pct"),
    carbsPct: doublePrecision("carbs_pct"),
    fatPct: doublePrecision("fat_pct"),
    fiberG: doublePrecision("fiber_g"),
    sugarMaxG: doublePrecision("sugar_max_g"),
    sodiumMaxMg: doublePrecision("sodium_max_mg"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("goal_profiles_user_idx").on(t.userId),
    uniqueIndex("goal_profiles_one_default_per_user")
      .on(t.userId)
      .where(sql`${t.isDefault} = true and ${t.archivedAt} is null`),
    check("goal_profiles_name_not_blank", sql`length(trim(${t.name})) > 0`),
    /** ISO weekdays only, no duplicates checked in the service (array semantics). */
    check(
      "goal_profiles_weekdays_valid",
      sql`${t.weekdays} <@ '{1,2,3,4,5,6,7}'::smallint[]`,
    ),
    check("goal_profiles_calorie_target_positive", sql`${t.calorieTarget} > 0`),
    /** Macro grams may be 0 (e.g. a zero-carb profile), never negative. */
    check(
      "goal_profiles_macros_non_negative",
      sql`${t.proteinG} >= 0 and ${t.carbsG} >= 0 and ${t.fatG} >= 0`,
    ),
    check(
      "goal_profiles_pct_range",
      sql`coalesce(${t.proteinPct}, 0) between 0 and 100 and coalesce(${t.carbsPct}, 0) between 0 and 100
        and coalesce(${t.fatPct}, 0) between 0 and 100`,
    ),
    check(
      "goal_profiles_optional_targets_positive",
      sql`coalesce(${t.fiberG}, 1) > 0 and coalesce(${t.sugarMaxG}, 1) > 0 and coalesce(${t.sodiumMaxMg}, 1) > 0`,
    ),
    /** An archived profile can't stay the default (the next default is picked by the service). */
    check(
      "goal_profiles_default_not_archived",
      sql`not (${t.isDefault} and ${t.archivedAt} is not null)`,
    ),
  ],
);

/**
 * Per-day record (DailyNutrition). Consumed totals are NOT stored here – they are
 * aggregated from meal_entries on read. This row freezes the targets that applied
 * on that day, so changing goals later does not rewrite history.
 *
 * Rules (Daily Nutrition Engine):
 * - Row is upserted when the first entry of a day is logged or a profile is assigned.
 * - For today/future dates targets are refreshed from the resolved goal profile when
 *   goals change; past days keep their snapshot.
 * - `profileOverridden` = user explicitly chose a profile for this date. If that profile is
 *   deleted later, goal_profile_id becomes null (targets stay frozen); readers treat
 *   "overridden but no profile" like "not overridden". Deliberately NOT a CHECK constraint –
 *   it would make the ON DELETE SET NULL fail.
 */
export const dailyNutrition = pgTable(
  "daily_nutrition",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    goalProfileId: uuid("goal_profile_id").references(() => goalProfiles.id, {
      onDelete: "set null",
    }),
    profileOverridden: boolean("profile_overridden").notNull().default(false),
    targetCalories: integer("target_calories").notNull(),
    targetProteinG: doublePrecision("target_protein_g").notNull(),
    targetCarbsG: doublePrecision("target_carbs_g").notNull(),
    targetFatG: doublePrecision("target_fat_g").notNull(),
    targetFiberG: doublePrecision("target_fiber_g"),
    note: text("note"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    /** PK also serves range scans (analytics, adherence, streaks). */
    primaryKey({ columns: [t.userId, t.date] }),
    /** FK support: deleting a goal profile sets goal_profile_id to null. */
    index("daily_nutrition_goal_profile_idx")
      .on(t.goalProfileId)
      .where(sql`${t.goalProfileId} is not null`),
    check(
      "daily_nutrition_target_calories_positive",
      sql`${t.targetCalories} > 0`,
    ),
    check(
      "daily_nutrition_targets_non_negative",
      sql`${t.targetProteinG} >= 0 and ${t.targetCarbsG} >= 0 and ${t.targetFatG} >= 0
        and coalesce(${t.targetFiberG}, 0) >= 0`,
    ),
  ],
);
