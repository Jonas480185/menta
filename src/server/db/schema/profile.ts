import {
  boolean,
  date,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { user } from "./auth";

export const sexEnum = pgEnum("sex", ["female", "male", "unspecified"]);
export const activityLevelEnum = pgEnum("activity_level", [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
]);
export const goalTypeEnum = pgEnum("goal_type", ["lose", "maintain", "gain"]);
export const goalPaceEnum = pgEnum("goal_pace", ["slow", "moderate", "fast"]);
export const themePreferenceEnum = pgEnum("theme_preference", ["system", "light", "dark"]);

/**
 * Body data + preferences captured during onboarding.
 * Owners: Onboarding writes it, Settings edits it,
 * Calorie Engine reads it.
 */
export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  sex: sexEnum("sex").notNull().default("unspecified"),
  birthDate: date("birth_date", { mode: "string" }),
  heightCm: doublePrecision("height_cm"),
  /** Weight at onboarding; the current weight comes from weight_entries. */
  startWeightKg: doublePrecision("start_weight_kg"),
  targetWeightKg: doublePrecision("target_weight_kg"),
  activityLevel: activityLevelEnum("activity_level").notNull().default("light"),
  goalType: goalTypeEnum("goal_type").notNull().default("maintain"),
  /** Null when goalType = maintain. */
  goalPace: goalPaceEnum("goal_pace"),
  /** Identifier of the CalorieCalculator implementation, e.g. "mifflin_st_jeor". */
  calculatorId: text("calculator_id").notNull().default("mifflin_st_jeor"),
  /** Last computed values, kept for transparency in the UI ("Erhaltungsbedarf"). */
  bmrKcal: integer("bmr_kcal"),
  tdeeKcal: integer("tdee_kcal"),
  /** Whether logged activity calories are added to the daily budget. */
  addActivityCalories: boolean("add_activity_calories").notNull().default(false),
  waterGoalMl: integer("water_goal_ml").notNull().default(2500),
  stepGoal: integer("step_goal").notNull().default(8000),
  timezone: text("timezone").notNull().default("Europe/Berlin"),
  locale: text("locale").notNull().default("de-DE"),
  theme: themePreferenceEnum("theme").notNull().default("system"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  ...timestamps,
});
