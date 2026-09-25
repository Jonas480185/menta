import { eq, inArray } from "drizzle-orm";
import type { ServiceContext } from "@/server/context";
import { mealEntries, recipeIngredients, recipes, user } from "@/server/db/schema";
import { notFound } from "@/lib/errors";

/**
 * Permanently deletes the account of `ctx.userId` and all its data.
 *
 * Every user-owned table references `user.id` with ON DELETE CASCADE (profile, goals, meals,
 * entries, own foods, recipes, tracking, sessions, credentials). Two FKs between those tables
 * are RESTRICT on purpose (meal_entries → meals, recipe_ingredients → foods); whether a plain
 * cascading delete trips them depends on the order Postgres fires the cascades (it does for
 * recipe_ingredients → foods, see tests). So those child rows are removed explicitly first,
 * all inside one transaction.
 *
 * Callers must verify the user's intent (password + typed confirmation) beforehand.
 */
export async function deleteAccount(ctx: ServiceContext): Promise<void> {
  const { userId } = ctx;
  await ctx.db.transaction(async (tx) => {
    await tx.delete(mealEntries).where(eq(mealEntries.userId, userId));
    await tx
      .delete(recipeIngredients)
      .where(
        inArray(
          recipeIngredients.recipeId,
          tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.userId, userId)),
        ),
      );
    const deleted = await tx.delete(user).where(eq(user.id, userId)).returning({ id: user.id });
    if (deleted.length === 0) throw notFound("Konto");
  });
}
