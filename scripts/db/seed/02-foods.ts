import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Db } from "../../../src/server/db/create";
import type { SeedStep } from "./types";

/**
 * PLUG-IN POINT for Food Data Import (Food Data Sources & Import).
 *
 * Contract: `scripts/food/seed-foods.ts` exports
 *   export async function seedFoods(db: Db): Promise<{ inserted?: number; updated?: number } | void>
 * It must be idempotent (upsert on foods (source, source_id), servings replaced per food).
 *
 * Loaded dynamically so this framework works before that file exists (step is skipped).
 */
export const FOOD_SEED_MODULE = path.join(
  process.cwd(),
  "scripts",
  "food",
  "seed-foods.ts",
);

type FoodSeedModule = {
  seedFoods?: (
    db: Db,
  ) => Promise<{ inserted?: number; updated?: number } | void>;
};

export const foodsStep: SeedStep = {
  name: "foods",
  description:
    "curated/base food database (scripts/food/seed-foods.ts)",
  async run({ db, log }) {
    if (!existsSync(FOOD_SEED_MODULE)) {
      return {
        status: "skipped",
        message: "scripts/food/seed-foods.ts not present yet",
      };
    }
    const mod = (await import(
      pathToFileURL(FOOD_SEED_MODULE).href
    )) as FoodSeedModule;
    if (typeof mod.seedFoods !== "function") {
      throw new Error("scripts/food/seed-foods.ts must export `seedFoods(db)`");
    }
    const result = await mod.seedFoods(db);
    if (result)
      log(`inserted ${result.inserted ?? 0}, updated ${result.updated ?? 0}`);
    return { status: "done" };
  },
};
