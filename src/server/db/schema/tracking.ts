import { sql } from "drizzle-orm";
import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { user } from "./auth";

/** WeightEntry – one per user per day. Owner: Weight Tracking. */
export const weightEntries = pgTable(
  "weight_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    weightKg: doublePrecision("weight_kg").notNull(),
    bodyFatPct: doublePrecision("body_fat_pct"),
    note: text("note"),
    source: text("source").notNull().default("manual"),
    ...timestamps,
  },
  (t) => [uniqueIndex("weight_entries_user_date_uq").on(t.userId, t.date)],
);

export const activityTypeEnum = pgEnum("activity_type", ["steps", "cardio", "strength", "sport", "other"]);
/** Integration source – manual today, wearables later. */
export const activitySourceEnum = pgEnum("activity_source", [
  "manual",
  "apple_health",
  "health_connect",
  "garmin",
  "fitbit",
  "other",
]);

/** Activity. Owner: Activity & Water (Activity Layer). */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    type: activityTypeEnum("type").notNull(),
    name: text("name").notNull(),
    durationMin: doublePrecision("duration_min"),
    steps: integer("steps"),
    distanceKm: doublePrecision("distance_km"),
    caloriesBurned: doublePrecision("calories_burned"),
    /** Free-form details, e.g. { sets: [...] } for strength training. */
    details: jsonb("details").$type<Record<string, unknown>>(),
    source: activitySourceEnum("source").notNull().default("manual"),
    /** Upstream id for de-duplicating synced activities. */
    externalId: text("external_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("activities_user_date_idx").on(t.userId, t.date),
    uniqueIndex("activities_source_external_uq")
      .on(t.userId, t.source, t.externalId)
      .where(sql`${t.externalId} is not null`),
  ],
);

/** WaterEntry. Owner: Activity & Water. */
export const waterEntries = pgTable(
  "water_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    amountMl: integer("amount_ml").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("water_entries_user_date_idx").on(t.userId, t.date)],
);

/** Unlocked achievements. Streaks/consistency are computed, not stored. Owner: Gamification. */
export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    achievementKey: text("achievement_key").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementKey] })],
);

/** Mascot interaction log – avoids repeating messages, records dismissals. Owner: Mascot Engine. */
export const mascotInteractions = pgTable(
  "mascot_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    messageKey: text("message_key").notNull(),
    action: text("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mascot_interactions_user_date_idx").on(t.userId, t.date)],
);
