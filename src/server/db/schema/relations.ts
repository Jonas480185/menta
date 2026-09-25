import { relations } from "drizzle-orm";
import { user } from "./auth";
import { userProfiles } from "./profile";
import { goalProfiles, dailyNutrition } from "./goals";
import {
  foods,
  foodBrands,
  foodServings,
  favoriteFoods,
  foodUsage,
} from "./foods";
import { meals, mealEntries } from "./meals";
import { recipes, recipeIngredients } from "./recipes";

export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [user.id],
    references: [userProfiles.userId],
  }),
  goalProfiles: many(goalProfiles),
  meals: many(meals),
}));

export const goalProfilesRelations = relations(goalProfiles, ({ one }) => ({
  user: one(user, { fields: [goalProfiles.userId], references: [user.id] }),
}));

export const dailyNutritionRelations = relations(dailyNutrition, ({ one }) => ({
  goalProfile: one(goalProfiles, {
    fields: [dailyNutrition.goalProfileId],
    references: [goalProfiles.id],
  }),
}));

export const foodsRelations = relations(foods, ({ one, many }) => ({
  brand: one(foodBrands, {
    fields: [foods.brandId],
    references: [foodBrands.id],
  }),
  servings: many(foodServings),
}));

export const foodServingsRelations = relations(foodServings, ({ one }) => ({
  food: one(foods, { fields: [foodServings.foodId], references: [foods.id] }),
}));

export const favoriteFoodsRelations = relations(favoriteFoods, ({ one }) => ({
  food: one(foods, { fields: [favoriteFoods.foodId], references: [foods.id] }),
}));

export const foodUsageRelations = relations(foodUsage, ({ one }) => ({
  food: one(foods, { fields: [foodUsage.foodId], references: [foods.id] }),
  lastServing: one(foodServings, {
    fields: [foodUsage.lastServingId],
    references: [foodServings.id],
  }),
}));

export const mealsRelations = relations(meals, ({ many }) => ({
  entries: many(mealEntries),
}));

export const mealEntriesRelations = relations(mealEntries, ({ one }) => ({
  meal: one(meals, { fields: [mealEntries.mealId], references: [meals.id] }),
  food: one(foods, { fields: [mealEntries.foodId], references: [foods.id] }),
  serving: one(foodServings, {
    fields: [mealEntries.servingId],
    references: [foodServings.id],
  }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  food: one(foods, { fields: [recipes.foodId], references: [foods.id] }),
  ingredients: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(
  recipeIngredients,
  ({ one }) => ({
    recipe: one(recipes, {
      fields: [recipeIngredients.recipeId],
      references: [recipes.id],
    }),
    food: one(foods, {
      fields: [recipeIngredients.foodId],
      references: [foods.id],
    }),
    serving: one(foodServings, {
      fields: [recipeIngredients.servingId],
      references: [foodServings.id],
    }),
  }),
);
