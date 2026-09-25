import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
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
import { timestamps, tsvector } from "./_shared";
import { user } from "./auth";
import { meals } from "./meals";

/** Where a food row came from. Recipes are exposed as foods (source = recipe). */
export const foodSourceEnum = pgEnum("food_source", [
  "usda",
  "off",
  "curated",
  "user",
  "recipe",
]);
/** Nutrient values are stored per 100 g (solids) or per 100 ml (liquids). */
export const nutrientBasisEnum = pgEnum("nutrient_basis", ["g", "ml"]);
export const foodVisibilityEnum = pgEnum("food_visibility", [
  "public",
  "private",
]);
export const dataQualityEnum = pgEnum("data_quality", [
  "verified",
  "complete",
  "partial",
  "suspect",
]);

export const foodBrands = pgTable(
  "food_brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull().unique(),
    ...timestamps,
  },
  (t) => [
    /** Brand autocomplete / fuzzy brand filter. */
    index("food_brands_name_trgm_idx").using(
      "gin",
      t.nameNormalized.op("gin_trgm_ops"),
    ),
  ],
);

/**
 * Index predicate shared by all search indexes on `foods`: only live public foods are
 * indexed for full-database search. A user's own foods and recipes (private) are found
 * via `foods_owner_idx` instead – see docs/architecture/database.md §Search.
 *
 * IMPORTANT for query authors: repeat this predicate LITERALLY in the WHERE clause
 * (`visibility = 'public' AND NOT is_archived`, not as bound parameters), otherwise the
 * planner cannot prove it matches the partial index and falls back to a sequential scan.
 */
export const PUBLIC_FOODS_PREDICATE = sql.raw(
  `visibility = 'public' AND NOT is_archived`,
);

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
    ownerUserId: text("owner_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    visibility: foodVisibilityEnum("visibility").notNull().default("public"),
    name: text("name").notNull(),
    /** lowercase, diacritics folded, whitespace collapsed – see src/domain/food/normalize.ts */
    nameNormalized: text("name_normalized").notNull(),
    brandId: uuid("brand_id").references(() => foodBrands.id, {
      onDelete: "set null",
    }),
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
    /**
     * Weighted full-text document, maintained by Postgres (GENERATED … STORED):
     * A = name, B = brand, C = category. Built from the pre-normalized columns with the
     * `simple` config (no stemming, no stop words) because `unaccent()` is not IMMUTABLE and
     * names are mixed German/English. Never written by the app.
     */
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('simple'::regconfig, coalesce(name_normalized, '')), 'A') || setweight(to_tsvector('simple'::regconfig, coalesce(brand_normalized, '')), 'B') || setweight(to_tsvector('simple'::regconfig, coalesce(category, '')), 'C')`,
    ),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("foods_source_source_id_uq")
      .on(t.source, t.sourceId)
      .where(sql`${t.sourceId} is not null`),
    index("foods_barcode_idx")
      .on(t.barcode)
      .where(sql`${t.barcode} is not null`),
    index("foods_brand_idx")
      .on(t.brandId)
      .where(sql`${t.brandId} is not null`),
    /** A user's own foods + recipes (search branch 2, "Meine Lebensmittel" list). */
    index("foods_owner_idx")
      .on(t.ownerUserId, t.nameNormalized)
      .where(sql`${t.ownerUserId} is not null`),
    /** "Popular foods" browsing and the popularity tie-breaker over public foods. */
    index("foods_popularity_idx")
      .on(t.popularity.desc())
      .where(PUBLIC_FOODS_PREDICATE),

    // --- Search (public foods only, see PUBLIC_FOODS_PREDICATE) ---------------------------
    /** Fuzzy / typo-tolerant: `%`, `<%` (word_similarity), `ILIKE '%x%'` on names. */
    index("foods_name_trgm_idx")
      .using("gin", t.nameNormalized.op("gin_trgm_ops"))
      .where(PUBLIC_FOODS_PREDICATE),
    /** Fuzzy brand match ("mueller" → "müller"). */
    index("foods_brand_trgm_idx")
      .using("gin", t.brandNormalized.op("gin_trgm_ops"))
      .where(PUBLIC_FOODS_PREDICATE),
    /** Full-text incl. word-prefix queries (`hafer:*`), ranked with ts_rank_cd. */
    index("foods_search_vector_idx")
      .using("gin", t.searchVector)
      .where(PUBLIC_FOODS_PREDICATE),
    /** Exact match and short (1–2 char) prefix queries: `name_normalized LIKE 'ha%'`. */
    index("foods_name_prefix_idx")
      .on(t.nameNormalized.op("text_pattern_ops"))
      .where(PUBLIC_FOODS_PREDICATE),

    // --- Data validity ------------------------------------------------------------------
    check(
      "foods_name_not_blank",
      sql`length(trim(${t.name})) > 0 and length(${t.nameNormalized}) > 0`,
    ),
    /** User and recipe foods always have an owner; database foods never do. */
    check(
      "foods_owner_matches_source",
      sql`(${t.source} in ('user', 'recipe')) = (${t.ownerUserId} is not null)`,
    ),
    /** Private foods must belong to someone (otherwise nobody could ever see them). */
    check(
      "foods_private_has_owner",
      sql`${t.visibility} = 'public' or ${t.ownerUserId} is not null`,
    ),
    check(
      "foods_nutrients_non_negative",
      sql`${t.kcal} >= 0 and ${t.proteinG} >= 0 and ${t.carbsG} >= 0 and ${t.fatG} >= 0
        and coalesce(${t.fiberG}, 0) >= 0 and coalesce(${t.sugarG}, 0) >= 0
        and coalesce(${t.saturatedFatG}, 0) >= 0 and coalesce(${t.saltG}, 0) >= 0
        and coalesce(${t.sodiumMg}, 0) >= 0 and coalesce(${t.potassiumMg}, 0) >= 0
        and coalesce(${t.calciumMg}, 0) >= 0 and coalesce(${t.ironMg}, 0) >= 0`,
    ),
    /**
     * Physical plausibility per 100 units. Per 100 g no single macro can exceed 100 g and
     * P+C+F may exceed 100 g only by a 5 g rounding tolerance; energy ≤ 1000 kcal (pure fat
     * ≈ 900). Per 100 ml the limits double, because dense liquids (honey ≈ 1.4 g/ml,
     * syrups) legitimately carry > 100 g of sugar per 100 ml. Everything stricter
     * (e.g. kcal vs. 4/4/9 plausibility) is a data-quality FLAG set by the importer,
     * not a hard constraint.
     */
    check(
      "foods_nutrients_plausible",
      sql`(case when ${t.nutrientBasis} = 'ml' then 2 else 1 end) * 100 >= greatest(
          ${t.proteinG}, ${t.carbsG}, ${t.fatG}, coalesce(${t.fiberG}, 0), coalesce(${t.sugarG}, 0),
          coalesce(${t.saturatedFatG}, 0), coalesce(${t.saltG}, 0))
        and (case when ${t.nutrientBasis} = 'ml' then 2 else 1 end) * 105 >= ${t.proteinG} + ${t.carbsG} + ${t.fatG}
        and (case when ${t.nutrientBasis} = 'ml' then 2 else 1 end) * 1000 >= ${t.kcal}`,
    ),
    check(
      "foods_density_positive",
      sql`${t.densityGPerMl} is null or ${t.densityGPerMl} > 0`,
    ),
    check("foods_popularity_non_negative", sql`${t.popularity} >= 0`),
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
  (t) => [
    index("food_servings_food_idx").on(t.foodId),
    check("food_servings_grams_positive", sql`${t.grams} > 0`),
    check("food_servings_amount_positive", sql`${t.amount} > 0`),
  ],
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.foodId] }),
    /** FK support: deleting a food must not scan all favorites. */
    index("favorite_foods_food_idx").on(t.foodId),
    /** "Favoriten" list, newest first. */
    index("favorite_foods_user_created_idx").on(t.userId, t.createdAt),
  ],
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
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastServingId: uuid("last_serving_id").references(() => foodServings.id, {
      onDelete: "set null",
    }),
    lastQuantity: doublePrecision("last_quantity"),
    lastMealId: uuid("last_meal_id").references((): AnyPgColumn => meals.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.foodId] }),
    index("food_usage_recent_idx").on(t.userId, t.lastUsedAt.desc()),
    index("food_usage_frequent_idx").on(t.userId, t.useCount.desc()),
    /** FK support for food / serving deletes. */
    index("food_usage_food_idx").on(t.foodId),
    index("food_usage_last_serving_idx")
      .on(t.lastServingId)
      .where(sql`${t.lastServingId} is not null`),
    check("food_usage_count_non_negative", sql`${t.useCount} >= 0`),
    check(
      "food_usage_last_quantity_positive",
      sql`${t.lastQuantity} is null or ${t.lastQuantity} > 0`,
    ),
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
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("external_lookup_cache_expires_idx").on(t.expiresAt)],
);
