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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	CONSTRAINT "daily_nutrition_user_id_date_pk" PRIMARY KEY("user_id","date")
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	CONSTRAINT "food_usage_user_id_food_id_pk" PRIMARY KEY("user_id","food_id")
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_brand_id_food_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."food_brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_serving_id_food_servings_id_fk" FOREIGN KEY ("serving_id") REFERENCES "public"."food_servings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "goal_profiles_user_idx" ON "goal_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_profiles_one_default_per_user" ON "goal_profiles" USING btree ("user_id") WHERE "goal_profiles"."is_default" = true and "goal_profiles"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "external_lookup_cache_expires_idx" ON "external_lookup_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "food_servings_food_idx" ON "food_servings" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "food_usage_recent_idx" ON "food_usage" USING btree ("user_id","last_used_at");--> statement-breakpoint
CREATE INDEX "food_usage_frequent_idx" ON "food_usage" USING btree ("user_id","use_count");--> statement-breakpoint
CREATE UNIQUE INDEX "foods_source_source_id_uq" ON "foods" USING btree ("source","source_id") WHERE "foods"."source_id" is not null;--> statement-breakpoint
CREATE INDEX "foods_barcode_idx" ON "foods" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "foods_brand_idx" ON "foods" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "foods_owner_idx" ON "foods" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "foods_popularity_idx" ON "foods" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "meal_entries_user_date_idx" ON "meal_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "meal_entries_user_food_idx" ON "meal_entries" USING btree ("user_id","food_id");--> statement-breakpoint
CREATE INDEX "meal_entries_meal_idx" ON "meal_entries" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "meals_user_idx" ON "meals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipes_user_idx" ON "recipes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activities_user_date_idx" ON "activities" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "activities_source_external_uq" ON "activities" USING btree ("user_id","source","external_id") WHERE "activities"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "mascot_interactions_user_date_idx" ON "mascot_interactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "water_entries_user_date_idx" ON "water_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "weight_entries_user_date_uq" ON "weight_entries" USING btree ("user_id","date");