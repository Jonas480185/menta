-- Custom SQL migration. drizzle-kit cannot express DEFERRABLE, and
-- the snapshot does not track it: if one of these FKs is ever re-created by a generated
-- migration (e.g. onDelete changed), re-apply the ALTER below in a new custom migration.
--
-- Why: deleting a user cascades to BOTH their foods/meals AND the rows that reference them
-- (recipe_ingredients, meal_entries). Postgres checks RI constraints fired inside a cascade at
-- the end of each cascaded sub-statement, so with an immediate RESTRICT/NO ACTION FK the user
-- delete fails depending on trigger order ("still referenced from recipe_ingredients").
-- DEFERRABLE INITIALLY DEFERRED moves the check to COMMIT, when the cascade is complete.
-- A direct DELETE of a food used in a recipe (or a meal slot with entries) still fails with
-- 23503 – in autocommit immediately, inside an explicit transaction at COMMIT.
ALTER TABLE "recipe_ingredients" ALTER CONSTRAINT "recipe_ingredients_food_id_foods_id_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "meal_entries" ALTER CONSTRAINT "meal_entries_meal_owner_fk" DEFERRABLE INITIALLY DEFERRED;
