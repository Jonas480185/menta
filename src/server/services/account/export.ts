import { asc, eq, inArray } from "drizzle-orm";
import type { ServiceContext } from "@/server/context";
import {
  activities,
  dailyNutrition,
  favoriteFoods,
  foodServings,
  foodUsage,
  foods,
  goalProfiles,
  mascotInteractions,
  mealEntries,
  meals,
  recipeIngredients,
  recipes,
  user,
  userAchievements,
  userProfiles,
  waterEntries,
  weightEntries,
} from "@/server/db/schema";
import { notFound } from "@/lib/errors";

export const EXPORT_FORMAT = "nutrition-app/user-export";
export const EXPORT_VERSION = 1;

type FoodRow = typeof foods.$inferSelect;

/** Search/ranking internals that mean nothing outside this app. */
const INTERNAL_FOOD_KEYS = /normalized$|vector$|^search|^popularity$/i;

function publicFoodFields(food: FoodRow): Record<string, unknown> {
  return Object.fromEntries(Object.entries(food).filter(([key]) => !INTERNAL_FOOD_KEYS.test(key)));
}

export interface UserDataExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  account: { id: string; name: string; email: string; emailVerified: boolean; createdAt: Date };
  profile: typeof userProfiles.$inferSelect | null;
  goalProfiles: (typeof goalProfiles.$inferSelect)[];
  dailyNutrition: (typeof dailyNutrition.$inferSelect)[];
  meals: (typeof meals.$inferSelect)[];
  mealEntries: (typeof mealEntries.$inferSelect)[];
  customFoods: (Record<string, unknown> & { servings: (typeof foodServings.$inferSelect)[] })[];
  recipes: (typeof recipes.$inferSelect & { ingredients: (typeof recipeIngredients.$inferSelect)[] })[];
  favoriteFoods: (typeof favoriteFoods.$inferSelect)[];
  foodUsage: (typeof foodUsage.$inferSelect)[];
  weightEntries: (typeof weightEntries.$inferSelect)[];
  activities: (typeof activities.$inferSelect)[];
  waterEntries: (typeof waterEntries.$inferSelect)[];
  achievements: (typeof userAchievements.$inferSelect)[];
  mascotInteractions: (typeof mascotInteractions.$inferSelect)[];
}

/**
 * Collects everything stored for `ctx.userId` (GDPR Art. 20 data portability).
 * Credentials and sessions are deliberately excluded. Every query is scoped by the user id;
 * child rows (servings, ingredients) are only loaded for foods/recipes the user owns.
 */
export async function exportUserData(ctx: ServiceContext, now: Date = new Date()): Promise<UserDataExport> {
  const { db, userId } = ctx;

  const [account] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId));
  if (!account) throw notFound("Konto");

  const [
    profileRows,
    goalRows,
    dailyRows,
    mealRows,
    entryRows,
    foodRows,
    recipeRows,
    favoriteRows,
    usageRows,
    weightRows,
    activityRows,
    waterRows,
    achievementRows,
    mascotRows,
  ] = await Promise.all([
    db.select().from(userProfiles).where(eq(userProfiles.userId, userId)),
    db.select().from(goalProfiles).where(eq(goalProfiles.userId, userId)).orderBy(asc(goalProfiles.createdAt)),
    db.select().from(dailyNutrition).where(eq(dailyNutrition.userId, userId)).orderBy(asc(dailyNutrition.date)),
    db.select().from(meals).where(eq(meals.userId, userId)).orderBy(asc(meals.sortOrder)),
    db
      .select()
      .from(mealEntries)
      .where(eq(mealEntries.userId, userId))
      .orderBy(asc(mealEntries.date), asc(mealEntries.sortOrder)),
    db.select().from(foods).where(eq(foods.ownerUserId, userId)).orderBy(asc(foods.createdAt)),
    db.select().from(recipes).where(eq(recipes.userId, userId)).orderBy(asc(recipes.createdAt)),
    db.select().from(favoriteFoods).where(eq(favoriteFoods.userId, userId)),
    db.select().from(foodUsage).where(eq(foodUsage.userId, userId)),
    db.select().from(weightEntries).where(eq(weightEntries.userId, userId)).orderBy(asc(weightEntries.date)),
    db.select().from(activities).where(eq(activities.userId, userId)).orderBy(asc(activities.date)),
    db.select().from(waterEntries).where(eq(waterEntries.userId, userId)).orderBy(asc(waterEntries.date)),
    db.select().from(userAchievements).where(eq(userAchievements.userId, userId)),
    db.select().from(mascotInteractions).where(eq(mascotInteractions.userId, userId)),
  ]);

  const foodIds = foodRows.map((f) => f.id);
  const recipeIds = recipeRows.map((r) => r.id);
  const [servingRows, ingredientRows] = await Promise.all([
    foodIds.length
      ? db
          .select()
          .from(foodServings)
          .where(inArray(foodServings.foodId, foodIds))
          .orderBy(asc(foodServings.sortOrder))
      : Promise.resolve([]),
    recipeIds.length
      ? db
          .select()
          .from(recipeIngredients)
          .where(inArray(recipeIngredients.recipeId, recipeIds))
          .orderBy(asc(recipeIngredients.sortOrder))
      : Promise.resolve([]),
  ]);

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    account,
    profile: profileRows[0] ?? null,
    goalProfiles: goalRows,
    dailyNutrition: dailyRows,
    meals: mealRows,
    mealEntries: entryRows,
    customFoods: foodRows.map((food) => ({
      ...publicFoodFields(food),
      servings: servingRows.filter((s) => s.foodId === food.id),
    })),
    recipes: recipeRows.map((recipe) => ({
      ...recipe,
      ingredients: ingredientRows.filter((i) => i.recipeId === recipe.id),
    })),
    favoriteFoods: favoriteRows,
    foodUsage: usageRows,
    weightEntries: weightRows,
    activities: activityRows,
    waterEntries: waterRows,
    achievements: achievementRows,
    mascotInteractions: mascotRows,
  };
}

/** File name for the download, e.g. "ernaehrung-export-2026-09-25.json". */
export function exportFileName(now: Date = new Date()): string {
  return `ernaehrung-export-${now.toISOString().slice(0, 10)}.json`;
}
