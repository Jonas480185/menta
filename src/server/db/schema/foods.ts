import { sql } from "drizzle-orm";
import {
  boolean,
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

/** Where a food row came from. Recipes are exposed as foods (source = recipe). */
export const foodSourceEnum = pgEnum("food_source", ["usda", "off", "curated", "user", "recipe"]);
/** Nutrient values are stored per 100 g (solids) or per 100 ml (liquids). */
export const nutrientBasisEnum = pgEnum("nutrient_basis", ["g", "ml"]);
export const foodVisibilityEnum = pgEnum("food_visibility", ["public", "private"]);
export const dataQualityEnum = pgEnum("data_quality", ["verified", "complete", "partial", "suspect"]);

export const foodBrands = pgTable("food_brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameNormalized: text("name_normalized").notNull().unique(),
  ...timestamps,
});

/**
 * Normalized internal food model. The app never works with provider payloads directly –
 * providers map into this shape (see src/server/food/types.ts).
 *
 * All nutrient columns are per 100 units of `nutrientBasis` (100 g or 100 ml).
 * Macros in grams, minerals in milligrams, energy in kcal.
 *
 * Owners: Food Data Import (data sources / import) writes public foods, Custom Foods writes user foods,
 * Recipes writes recipe foods, Database owns indexes & search infrastructure.
 */
export const foods = pgTable(
  "foods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: foodSourceEnum("source").notNull(),
    /** ID in the upstream provider (FDC id, OFF barcode, recipe id, ...). */
    sourceId: text("source_id"),
    /** Set for user- and recipe-foods; null for public database foods. */
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "cascade" }),
    visibility: foodVisibilityEnum("visibility").notNull().default("public"),
    name: text("name").notNull(),
    /** lowercase, diacritics folded, whitespace collapsed – see src/domain/food/normalize.ts */
    nameNormalized: text("name_normalized").notNull(),
    brandId: uuid("brand_id").references(() => foodBrands.id, { onDelete: "set null" }),
    /** Denormalized brand name for display and search. */
    brandName: text("brand_name"),
    brandNormalized: text("brand_normalized"),
    barcode: text("barcode"),
    category: text("category"),
    language: text("language"),
    countries: text("countries").array(),
    imageUrl: text("image_url"),

    nutrientBasis: nutrientBasisEnum("nutrient_basis").notNull().default("g"),
    /** g per ml, used to convert ml servings of liquids when needed. */
    densityGPerMl: doublePrecision("density_g_per_ml"),

    kcal: doublePrecision("kcal").notNull(),
    proteinG: doublePrecision("protein_g").notNull(),
    carbsG: doublePrecision("carbs_g").notNull(),
    fatG: doublePrecision("fat_g").notNull(),
    fiberG: doublePrecision("fiber_g"),
    sugarG: doublePrecision("sugar_g"),
    saturatedFatG: doublePrecision("saturated_fat_g"),
    saltG: doublePrecision("salt_g"),
    sodiumMg: doublePrecision("sodium_mg"),
    potassiumMg: doublePrecision("potassium_mg"),
    calciumMg: doublePrecision("calcium_mg"),
    ironMg: doublePrecision("iron_mg"),
    /** Further micronutrients keyed by nutrient code, e.g. { "vitamin_c_mg": 12.3 }. */
    micronutrients: jsonb("micronutrients").$type<Record<string, number>>(),

    dataQuality: dataQualityEnum("data_quality").notNull().default("complete"),
    qualityFlags: text("quality_flags").array(),
    /** Global popularity (log count across users + upstream scan counts), used for ranking. */
    popularity: integer("popularity").notNull().default(0),
    isArchived: boolean("is_archived").notNull().default(false),
    /** When the upstream provider was last consulted for this row. */
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("foods_source_source_id_uq")
      .on(t.source, t.sourceId)
      .where(sql`${t.sourceId} is not null`),
    index("foods_barcode_idx").on(t.barcode),
    index("foods_brand_idx").on(t.brandId),
    index("foods_owner_idx").on(t.ownerUserId),
    index("foods_popularity_idx").on(t.popularity),
  ],
);

/**
 * Portion definitions (FoodServing). `grams` is the amount in the food's nutrient basis
 * unit (g, or ml for nutrientBasis = ml) that one serving corresponds to.
 * Every food gets at least a "100 g"/"100 ml" serving.
 */
export const foodServings = pgTable(
  "food_servings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    /** Display label, e.g. "1 Scheibe", "1 Portion (250 ml)". */
    label: text("label").notNull(),
    amount: doublePrecision("amount").notNull().default(1),
    /** Unit code: g | ml | piece | slice | serving | tbsp | tsp | package | cup | ... */
    unit: text("unit").notNull(),
    grams: doublePrecision("grams").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("food_servings_food_idx").on(t.foodId)],
);

/** FavoriteFood */
export const favoriteFoods = pgTable(
  "favorite_foods",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.foodId] })],
);

/**
 * RecentFood + frequent foods in one table. Upserted on every log,
 * read by Food Search ranking. Also remembers the last used portion
 * so re-logging is a single tap.
 */
export const foodUsage = pgTable(
  "food_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    useCount: integer("use_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    lastServingId: uuid("last_serving_id").references(() => foodServings.id, {
      onDelete: "set null",
    }),
    lastQuantity: doublePrecision("last_quantity"),
    lastMealId: uuid("last_meal_id"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.foodId] }),
    index("food_usage_recent_idx").on(t.userId, t.lastUsedAt),
    index("food_usage_frequent_idx").on(t.userId, t.useCount),
  ],
);

/**
 * Cache for external provider calls (search queries and barcode lookups), including
 * negative results ("barcode not found") so we don't hammer upstream APIs.
 * Owner: Food Search / Barcode / Performance.
 */
export const externalLookupCache = pgTable(
  "external_lookup_cache",
  {
    /** e.g. "off:search:de:haferflocken" or "off:barcode:4001234567890" */
    key: text("key").primaryKey(),
    provider: text("provider").notNull(),
    kind: text("kind").notNull(),
    found: boolean("found").notNull().default(true),
    /** Food ids (in our DB) produced by this lookup. */
    foodIds: uuid("food_ids").array(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("external_lookup_cache_expires_idx").on(t.expiresAt)],
);
