CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'light', 'moderate', 'active', 'very_active');--> statement-breakpoint
CREATE TYPE "public"."goal_pace" AS ENUM('slow', 'moderate', 'fast');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('lose', 'maintain', 'gain');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('female', 'male', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('system', 'light', 'dark');--> statement-breakpoint
CREATE TYPE "public"."calorie_source" AS ENUM('calculated', 'manual');--> statement-breakpoint
CREATE TYPE "public"."goal_profile_kind" AS ENUM('default', 'training', 'rest', 'high_carb', 'low_carb', 'refeed', 'custom');--> statement-breakpoint
CREATE TYPE "public"."macro_mode" AS ENUM('percent', 'grams', 'auto');--> statement-breakpoint
CREATE TYPE "public"."data_quality" AS ENUM('verified', 'complete', 'partial', 'suspect');--> statement-breakpoint
CREATE TYPE "public"."food_source" AS ENUM('usda', 'off', 'curated', 'user', 'recipe');--> statement-breakpoint
CREATE TYPE "public"."food_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."nutrient_basis" AS ENUM('g', 'ml');--> statement-breakpoint
CREATE TYPE "public"."activity_source" AS ENUM('manual', 'apple_health', 'health_connect', 'garmin', 'fitbit', 'other');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('steps', 'cardio', 'strength', 'sport', 'other');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sex" "sex" DEFAULT 'unspecified' NOT NULL,
	"birth_date" date,
	"height_cm" double precision,
	"start_weight_kg" double precision,
	"target_weight_kg" double precision,
	"activity_level" "activity_level" DEFAULT 'light' NOT NULL,
	"goal_type" "goal_type" DEFAULT 'maintain' NOT NULL,
	"goal_pace" "goal_pace",
	"calculator_id" text DEFAULT 'mifflin_st_jeor' NOT NULL,
	"bmr_kcal" integer,
	"tdee_kcal" integer,
	"add_activity_calories" boolean DEFAULT false NOT NULL,
	"water_goal_ml" integer DEFAULT 2500 NOT NULL,
	"step_goal" integer DEFAULT 8000 NOT NULL,
	"timezone" text DEFAULT 'Europe/Berlin' NOT NULL,
	"locale" text DEFAULT 'de-DE' NOT NULL,
	"theme" "theme_preference" DEFAULT 'system' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_height_range" CHECK ("user_profiles"."height_cm" is null or "user_profiles"."height_cm" between 50 and 300),
	CONSTRAINT "user_profiles_weight_range" CHECK (("user_profiles"."start_weight_kg" is null or "user_profiles"."start_weight_kg" between 20 and 400)
      and ("user_profiles"."target_weight_kg" is null or "user_profiles"."target_weight_kg" between 20 and 400)),
	CONSTRAINT "user_profiles_energy_non_negative" CHECK (coalesce("user_profiles"."bmr_kcal", 0) >= 0 and coalesce("user_profiles"."tdee_kcal", 0) >= 0),
	CONSTRAINT "user_profiles_goals_non_negative" CHECK ("user_profiles"."water_goal_ml" >= 0 and "user_profiles"."step_goal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "daily_nutrition" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"goal_profile_id" uuid,
	"profile_overridden" boolean DEFAULT false NOT NULL,
	"target_calories" integer NOT NULL,
	"target_protein_g" double precision NOT NULL,
	"target_carbs_g" double precision NOT NULL,
	"target_fat_g" double precision NOT NULL,
	"target_fiber_g" double precision,
	"note" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_nutrition_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "daily_nutrition_target_calories_positive" CHECK ("daily_nutrition"."target_calories" > 0),
	CONSTRAINT "daily_nutrition_targets_non_negative" CHECK ("daily_nutrition"."target_protein_g" >= 0 and "daily_nutrition"."target_carbs_g" >= 0 and "daily_nutrition"."target_fat_g" >= 0
        and coalesce("daily_nutrition"."target_fiber_g", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "goal_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "goal_profile_kind" DEFAULT 'default' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"weekdays" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"calorie_target" integer NOT NULL,
	"calorie_source" "calorie_source" DEFAULT 'calculated' NOT NULL,
	"macro_mode" "macro_mode" DEFAULT 'auto' NOT NULL,
	"protein_g" double precision NOT NULL,
	"carbs_g" double precision NOT NULL,
	"fat_g" double precision NOT NULL,
	"protein_pct" double precision,
	"carbs_pct" double precision,
	"fat_pct" double precision,
	"fiber_g" double precision,
	"sugar_max_g" double precision,
	"sodium_max_mg" double precision,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_profiles_name_not_blank" CHECK (length(trim("goal_profiles"."name")) > 0),
	CONSTRAINT "goal_profiles_weekdays_valid" CHECK ("goal_profiles"."weekdays" <@ '{1,2,3,4,5,6,7}'::smallint[]),
	CONSTRAINT "goal_profiles_calorie_target_positive" CHECK ("goal_profiles"."calorie_target" > 0),
	CONSTRAINT "goal_profiles_macros_non_negative" CHECK ("goal_profiles"."protein_g" >= 0 and "goal_profiles"."carbs_g" >= 0 and "goal_profiles"."fat_g" >= 0),
	CONSTRAINT "goal_profiles_pct_range" CHECK (coalesce("goal_profiles"."protein_pct", 0) between 0 and 100 and coalesce("goal_profiles"."carbs_pct", 0) between 0 and 100
        and coalesce("goal_profiles"."fat_pct", 0) between 0 and 100),
	CONSTRAINT "goal_profiles_optional_targets_positive" CHECK (coalesce("goal_profiles"."fiber_g", 1) > 0 and coalesce("goal_profiles"."sugar_max_g", 1) > 0 and coalesce("goal_profiles"."sodium_max_mg", 1) > 0),
	CONSTRAINT "goal_profiles_default_not_archived" CHECK (not ("goal_profiles"."is_default" and "goal_profiles"."archived_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "external_lookup_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"kind" text NOT NULL,
	"found" boolean DEFAULT true NOT NULL,
	"food_ids" uuid[],
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_foods" (
	"user_id" text NOT NULL,
	"food_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_foods_user_id_food_id_pk" PRIMARY KEY("user_id","food_id")
);
--> statement-breakpoint
CREATE TABLE "food_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_brands_name_normalized_unique" UNIQUE("name_normalized")
);
--> statement-breakpoint
CREATE TABLE "food_servings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount" double precision DEFAULT 1 NOT NULL,
	"unit" text NOT NULL,
	"grams" double precision NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_servings_grams_positive" CHECK ("food_servings"."grams" > 0),
	CONSTRAINT "food_servings_amount_positive" CHECK ("food_servings"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "food_usage" (
	"user_id" text NOT NULL,
	"food_id" uuid NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_serving_id" uuid,
	"last_quantity" double precision,
	"last_meal_id" uuid,
	CONSTRAINT "food_usage_user_id_food_id_pk" PRIMARY KEY("user_id","food_id"),
	CONSTRAINT "food_usage_count_non_negative" CHECK ("food_usage"."use_count" >= 0),
	CONSTRAINT "food_usage_last_quantity_positive" CHECK ("food_usage"."last_quantity" is null or "food_usage"."last_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "food_source" NOT NULL,
	"source_id" text,
	"owner_user_id" text,
	"visibility" "food_visibility" DEFAULT 'public' NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"brand_id" uuid,
	"brand_name" text,
	"brand_normalized" text,
	"barcode" text,
	"category" text,
	"language" text,
	"countries" text[],
	"image_url" text,
	"nutrient_basis" "nutrient_basis" DEFAULT 'g' NOT NULL,
	"density_g_per_ml" double precision,
	"kcal" double precision NOT NULL,
	"protein_g" double precision NOT NULL,
	"carbs_g" double precision NOT NULL,
	"fat_g" double precision NOT NULL,
	"fiber_g" double precision,
	"sugar_g" double precision,
	"saturated_fat_g" double precision,
	"salt_g" double precision,
	"sodium_mg" double precision,
	"potassium_mg" double precision,
	"calcium_mg" double precision,
	"iron_mg" double precision,
	"micronutrients" jsonb,
	"data_quality" "data_quality" DEFAULT 'complete' NOT NULL,
	"quality_flags" text[],
	"popularity" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple'::regconfig, coalesce(name_normalized, '')), 'A') || setweight(to_tsvector('simple'::regconfig, coalesce(brand_normalized, '')), 'B') || setweight(to_tsvector('simple'::regconfig, translate(replace(lower(coalesce(category, '')), 'ß', 'ss'), 'àáâãäåçèéêëìíîïñòóôõöøùúûüýÿ', 'aaaaaaceeeeiiiinoooooouuuuyy')), 'C')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foods_name_not_blank" CHECK (length(trim("foods"."name")) > 0 and length("foods"."name_normalized") > 0),
	CONSTRAINT "foods_owner_matches_source" CHECK (("foods"."source" in ('user', 'recipe')) = ("foods"."owner_user_id" is not null)),
	CONSTRAINT "foods_private_has_owner" CHECK ("foods"."visibility" = 'public' or "foods"."owner_user_id" is not null),
	CONSTRAINT "foods_nutrients_non_negative" CHECK ("foods"."kcal" >= 0 and "foods"."protein_g" >= 0 and "foods"."carbs_g" >= 0 and "foods"."fat_g" >= 0
        and coalesce("foods"."fiber_g", 0) >= 0 and coalesce("foods"."sugar_g", 0) >= 0
        and coalesce("foods"."saturated_fat_g", 0) >= 0 and coalesce("foods"."salt_g", 0) >= 0
        and coalesce("foods"."sodium_mg", 0) >= 0 and coalesce("foods"."potassium_mg", 0) >= 0
        and coalesce("foods"."calcium_mg", 0) >= 0 and coalesce("foods"."iron_mg", 0) >= 0),
	CONSTRAINT "foods_nutrients_plausible" CHECK ((case when "foods"."nutrient_basis" = 'ml' then 2 else 1 end) * 100 >= greatest(
          "foods"."protein_g", "foods"."carbs_g", "foods"."fat_g", coalesce("foods"."fiber_g", 0), coalesce("foods"."sugar_g", 0),
          coalesce("foods"."saturated_fat_g", 0), coalesce("foods"."salt_g", 0))
        and (case when "foods"."nutrient_basis" = 'ml' then 2 else 1 end) * 105 >= "foods"."protein_g" + "foods"."carbs_g" + "foods"."fat_g"
        and (case when "foods"."nutrient_basis" = 'ml' then 2 else 1 end) * 1000 >= "foods"."kcal"),
	CONSTRAINT "foods_density_positive" CHECK ("foods"."density_g_per_ml" is null or "foods"."density_g_per_ml" > 0),
	CONSTRAINT "foods_popularity_non_negative" CHECK ("foods"."popularity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "meal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"meal_id" uuid NOT NULL,
	"food_id" uuid,
	"recipe_id" uuid,
	"serving_id" uuid,
	"food_name" text NOT NULL,
	"brand_name" text,
	"serving_label" text NOT NULL,
	"serving_grams" double precision NOT NULL,
	"quantity" double precision NOT NULL,
	"grams" double precision NOT NULL,
	"kcal" double precision NOT NULL,
	"protein_g" double precision NOT NULL,
	"carbs_g" double precision NOT NULL,
	"fat_g" double precision NOT NULL,
	"fiber_g" double precision,
	"sugar_g" double precision,
	"saturated_fat_g" double precision,
	"sodium_mg" double precision,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_entries_quantity_positive" CHECK ("meal_entries"."quantity" > 0),
	CONSTRAINT "meal_entries_grams_non_negative" CHECK ("meal_entries"."grams" >= 0 and "meal_entries"."serving_grams" >= 0),
	CONSTRAINT "meal_entries_nutrients_non_negative" CHECK ("meal_entries"."kcal" >= 0 and "meal_entries"."protein_g" >= 0 and "meal_entries"."carbs_g" >= 0 and "meal_entries"."fat_g" >= 0
        and coalesce("meal_entries"."fiber_g", 0) >= 0 and coalesce("meal_entries"."sugar_g", 0) >= 0
        and coalesce("meal_entries"."saturated_fat_g", 0) >= 0 and coalesce("meal_entries"."sodium_mg", 0) >= 0),
	CONSTRAINT "meal_entries_food_name_not_blank" CHECK (length(trim("meal_entries"."food_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"default_time" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meals_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "meals_default_time_format" CHECK ("meals"."default_time" is null or "meals"."default_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"serving_id" uuid,
	"quantity" double precision NOT NULL,
	"grams" double precision NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_ingredients_quantity_positive" CHECK ("recipe_ingredients"."quantity" > 0),
	CONSTRAINT "recipe_ingredients_grams_positive" CHECK ("recipe_ingredients"."grams" > 0)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"servings" double precision DEFAULT 1 NOT NULL,
	"total_weight_g" double precision,
	"food_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_servings_positive" CHECK ("recipes"."servings" > 0),
	CONSTRAINT "recipes_total_weight_positive" CHECK ("recipes"."total_weight_g" is null or "recipes"."total_weight_g" > 0),
	CONSTRAINT "recipes_name_not_blank" CHECK (length(trim("recipes"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"type" "activity_type" NOT NULL,
	"name" text NOT NULL,
	"duration_min" double precision,
	"steps" integer,
	"distance_km" double precision,
	"calories_burned" double precision,
	"details" jsonb,
	"source" "activity_source" DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_values_non_negative" CHECK (coalesce("activities"."duration_min", 0) >= 0 and coalesce("activities"."steps", 0) >= 0
        and coalesce("activities"."distance_km", 0) >= 0 and coalesce("activities"."calories_burned", 0) >= 0),
	CONSTRAINT "activities_name_not_blank" CHECK (length(trim("activities"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "mascot_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"message_key" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" text NOT NULL,
	"achievement_key" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb,
	CONSTRAINT "user_achievements_user_id_achievement_key_pk" PRIMARY KEY("user_id","achievement_key")
);
--> statement-breakpoint
CREATE TABLE "water_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"amount_ml" integer NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "water_entries_amount_positive" CHECK ("water_entries"."amount_ml" > 0)
);
--> statement-breakpoint
CREATE TABLE "weight_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"weight_kg" double precision NOT NULL,
	"body_fat_pct" double precision,
	"note" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weight_entries_weight_range" CHECK ("weight_entries"."weight_kg" between 20 and 400),
	CONSTRAINT "weight_entries_body_fat_range" CHECK ("weight_entries"."body_fat_pct" is null or "weight_entries"."body_fat_pct" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_nutrition" ADD CONSTRAINT "daily_nutrition_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_nutrition" ADD CONSTRAINT "daily_nutrition_goal_profile_id_goal_profiles_id_fk" FOREIGN KEY ("goal_profile_id") REFERENCES "public"."goal_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_profiles" ADD CONSTRAINT "goal_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_foods" ADD CONSTRAINT "favorite_foods_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_foods" ADD CONSTRAINT "favorite_foods_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_servings" ADD CONSTRAINT "food_servings_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_usage" ADD CONSTRAINT "food_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_usage" ADD CONSTRAINT "food_usage_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_usage" ADD CONSTRAINT "food_usage_last_serving_id_food_servings_id_fk" FOREIGN KEY ("last_serving_id") REFERENCES "public"."food_servings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_usage" ADD CONSTRAINT "food_usage_last_meal_id_meals_id_fk" FOREIGN KEY ("last_meal_id") REFERENCES "public"."meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_brand_id_food_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."food_brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_serving_id_food_servings_id_fk" FOREIGN KEY ("serving_id") REFERENCES "public"."food_servings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_meal_owner_fk" FOREIGN KEY ("meal_id","user_id") REFERENCES "public"."meals"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_serving_id_food_servings_id_fk" FOREIGN KEY ("serving_id") REFERENCES "public"."food_servings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mascot_interactions" ADD CONSTRAINT "mascot_interactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_entries" ADD CONSTRAINT "water_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "daily_nutrition_goal_profile_idx" ON "daily_nutrition" USING btree ("goal_profile_id") WHERE "daily_nutrition"."goal_profile_id" is not null;--> statement-breakpoint
CREATE INDEX "goal_profiles_user_idx" ON "goal_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_profiles_one_default_per_user" ON "goal_profiles" USING btree ("user_id") WHERE "goal_profiles"."is_default" = true and "goal_profiles"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "external_lookup_cache_expires_idx" ON "external_lookup_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "favorite_foods_food_idx" ON "favorite_foods" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "favorite_foods_user_created_idx" ON "favorite_foods" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "food_brands_name_trgm_idx" ON "food_brands" USING gin ("name_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "food_servings_food_idx" ON "food_servings" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "food_usage_recent_idx" ON "food_usage" USING btree ("user_id","last_used_at");--> statement-breakpoint
CREATE INDEX "food_usage_frequent_idx" ON "food_usage" USING btree ("user_id","use_count");--> statement-breakpoint
CREATE INDEX "food_usage_food_idx" ON "food_usage" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "food_usage_last_serving_idx" ON "food_usage" USING btree ("last_serving_id") WHERE "food_usage"."last_serving_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_source_source_id_uq" ON "foods" USING btree ("source","source_id") WHERE "foods"."source_id" is not null;--> statement-breakpoint
CREATE INDEX "foods_barcode_idx" ON "foods" USING btree ("barcode") WHERE "foods"."barcode" is not null;--> statement-breakpoint
CREATE INDEX "foods_brand_idx" ON "foods" USING btree ("brand_id") WHERE "foods"."brand_id" is not null;--> statement-breakpoint
CREATE INDEX "foods_owner_idx" ON "foods" USING btree ("owner_user_id","name_normalized") WHERE "foods"."owner_user_id" is not null;--> statement-breakpoint
CREATE INDEX "foods_popularity_idx" ON "foods" USING btree ("popularity") WHERE visibility = 'public' AND NOT is_archived;--> statement-breakpoint
CREATE INDEX "foods_name_trgm_idx" ON "foods" USING gin ("name_normalized" gin_trgm_ops) WHERE visibility = 'public' AND NOT is_archived;--> statement-breakpoint
CREATE INDEX "foods_brand_trgm_idx" ON "foods" USING gin ("brand_normalized" gin_trgm_ops) WHERE visibility = 'public' AND NOT is_archived;--> statement-breakpoint
CREATE INDEX "foods_search_vector_idx" ON "foods" USING gin ("search_vector") WHERE visibility = 'public' AND NOT is_archived;--> statement-breakpoint
CREATE INDEX "foods_name_prefix_idx" ON "foods" USING btree ("name_normalized" text_pattern_ops) WHERE visibility = 'public' AND NOT is_archived;--> statement-breakpoint
CREATE INDEX "meal_entries_user_date_idx" ON "meal_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "meal_entries_user_food_idx" ON "meal_entries" USING btree ("user_id","food_id");--> statement-breakpoint
CREATE INDEX "meal_entries_meal_idx" ON "meal_entries" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "meal_entries_food_idx" ON "meal_entries" USING btree ("food_id") WHERE "meal_entries"."food_id" is not null;--> statement-breakpoint
CREATE INDEX "meal_entries_serving_idx" ON "meal_entries" USING btree ("serving_id") WHERE "meal_entries"."serving_id" is not null;--> statement-breakpoint
CREATE INDEX "meal_entries_recipe_idx" ON "meal_entries" USING btree ("recipe_id") WHERE "meal_entries"."recipe_id" is not null;--> statement-breakpoint
CREATE INDEX "meals_user_idx" ON "meals" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_idx" ON "recipe_ingredients" USING btree ("recipe_id","sort_order");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_food_idx" ON "recipe_ingredients" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_serving_idx" ON "recipe_ingredients" USING btree ("serving_id") WHERE "recipe_ingredients"."serving_id" is not null;--> statement-breakpoint
CREATE INDEX "recipes_user_idx" ON "recipes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_food_uq" ON "recipes" USING btree ("food_id") WHERE "recipes"."food_id" is not null;--> statement-breakpoint
CREATE INDEX "activities_user_date_idx" ON "activities" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "activities_source_external_uq" ON "activities" USING btree ("user_id","source","external_id") WHERE "activities"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "mascot_interactions_user_date_idx" ON "mascot_interactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "water_entries_user_date_idx" ON "water_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "weight_entries_user_date_uq" ON "weight_entries" USING btree ("user_id","date");