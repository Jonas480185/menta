import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import type { Db } from "@/server/db/create";
import type { ServiceContext } from "@/server/context";
import {
  account,
  foodServings,
  foods,
  goalProfiles,
  mealEntries,
  meals,
  recipeIngredients,
  recipes,
  session,
  user,
  userProfiles,
  waterEntries,
  weightEntries,
} from "@/server/db/schema";
import { normalizeFoodText } from "@/domain/food/normalize";
import { AppError } from "@/lib/errors";
import { bootstrapNewUser, DEFAULT_MEALS } from "./bootstrap";
import { EXPORT_FORMAT, exportUserData } from "./export";
import { deleteAccount } from "./delete";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

let n = 0;
async function insertBareUser(): Promise<string> {
  const id = `acc-${Date.now()}-${++n}`;
  await db.insert(user).values({ id, name: "Bare", email: `${id}@example.com` });
  return id;
}

/** Seeds one row in most user tables so scoping can be checked. */
async function seedUserData(ctx: ServiceContext & { mealIds: Record<string, string> }, label: string) {
  const [food] = await db
    .insert(foods)
    .values({
      source: "user",
      ownerUserId: ctx.userId,
      visibility: "private",
      name: `Müsli ${label}`,
      nameNormalized: normalizeFoodText(`Müsli ${label}`),
      kcal: 380,
      proteinG: 10,
      carbsG: 60,
      fatG: 8,
    })
    .returning();
  await db.insert(foodServings).values({ foodId: food.id, label: "100 g", unit: "g", grams: 100 });
  const [recipe] = await db
    .insert(recipes)
    .values({ userId: ctx.userId, name: `Bowl ${label}`, servings: 2 })
    .returning();
  await db.insert(recipeIngredients).values({ recipeId: recipe.id, foodId: food.id, quantity: 1, grams: 80 });
  await db.insert(mealEntries).values({
    userId: ctx.userId,
    date: "2026-09-24",
    mealId: ctx.mealIds.breakfast,
    foodId: food.id,
    foodName: food.name,
    servingLabel: "100 g",
    servingGrams: 100,
    quantity: 1,
    grams: 100,
    kcal: 380,
    proteinG: 10,
    carbsG: 60,
    fatG: 8,
  });
  await db.insert(goalProfiles).values({
    userId: ctx.userId,
    name: "Standard",
    isDefault: true,
    calorieTarget: 2200,
    proteinG: 140,
    carbsG: 250,
    fatG: 70,
  });
  await db.insert(weightEntries).values({ userId: ctx.userId, date: "2026-09-24", weightKg: 80.5 });
  await db.insert(waterEntries).values({ userId: ctx.userId, date: "2026-09-24", amountMl: 500 });
  return { food, recipe };
}

describe("bootstrapNewUser", () => {
  it("creates the profile and four default meals", async () => {
    const userId = await insertBareUser();
    const result = await bootstrapNewUser(db, userId);
    expect(result).toEqual({ createdProfile: true, createdMeals: 4 });

    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    expect(profile.timezone).toBe("Europe/Berlin");
    expect(profile.onboardingCompletedAt).toBeNull();

    const rows = await db.select().from(meals).where(eq(meals.userId, userId)).orderBy(meals.sortOrder);
    expect(rows.map((m) => [m.name, m.icon, m.sortOrder])).toEqual(
      DEFAULT_MEALS.map((m) => [m.name, m.icon, m.sortOrder]),
    );
    const goals = await db.select().from(goalProfiles).where(eq(goalProfiles.userId, userId));
    expect(goals).toHaveLength(0);
  });

  it("is idempotent (sequential and concurrent calls)", async () => {
    const userId = await insertBareUser();
    await bootstrapNewUser(db, userId);
    expect(await bootstrapNewUser(db, userId)).toEqual({ createdProfile: false, createdMeals: 0 });

    const other = await insertBareUser();
    await Promise.all([bootstrapNewUser(db, other), bootstrapNewUser(db, other), bootstrapNewUser(db, other)]);
    expect(await db.select().from(meals).where(eq(meals.userId, other))).toHaveLength(4);
    expect(await db.select().from(userProfiles).where(eq(userProfiles.userId, other))).toHaveLength(1);
  });

  it("does not re-create meals the user archived, but repairs a missing profile", async () => {
    const ctx = await createTestUser(db);
    await db.update(meals).set({ isArchived: true }).where(eq(meals.userId, ctx.userId));
    await db.delete(userProfiles).where(eq(userProfiles.userId, ctx.userId));

    expect(await bootstrapNewUser(db, ctx.userId)).toEqual({ createdProfile: true, createdMeals: 0 });
    expect(await db.select().from(meals).where(eq(meals.userId, ctx.userId))).toHaveLength(4);
  });
});

describe("exportUserData", () => {
  it("exports only the requesting user's data", async () => {
    const alice = await createTestUser(db, { timezone: "Europe/Vienna" });
    const bob = await createTestUser(db);
    const aliceData = await seedUserData(alice, "Alice");
    await seedUserData(bob, "Bob");

    const now = new Date("2026-09-25T10:00:00Z");
    const data = await exportUserData(alice, now);

    expect(data.format).toBe(EXPORT_FORMAT);
    expect(data.exportedAt).toBe(now.toISOString());
    expect(data.account.id).toBe(alice.userId);
    expect(data.account).not.toHaveProperty("password");
    expect(data.profile?.timezone).toBe("Europe/Vienna");
    expect(data.meals).toHaveLength(4);
    expect(data.mealEntries).toHaveLength(1);
    expect(data.goalProfiles).toHaveLength(1);
    expect(data.weightEntries).toHaveLength(1);
    expect(data.waterEntries).toHaveLength(1);
    expect(data.customFoods).toHaveLength(1);
    expect(data.customFoods[0]).toMatchObject({ id: aliceData.food.id, name: "Müsli Alice" });
    expect(data.customFoods[0]).not.toHaveProperty("nameNormalized");
    expect(data.customFoods[0].servings).toHaveLength(1);
    expect(data.recipes).toHaveLength(1);
    expect(data.recipes[0].ingredients).toHaveLength(1);

    const json = JSON.stringify(data);
    expect(json).not.toContain(bob.userId);
    expect(json).not.toContain("Bob");
  });

  it("throws NOT_FOUND for an unknown user", async () => {
    await expect(exportUserData({ db, userId: "nope", timezone: "Europe/Berlin" })).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

describe("deleteAccount", () => {
  it("removes the user and all their data, leaving other users untouched", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    const aliceData = await seedUserData(alice, "A");
    const bobData = await seedUserData(bob, "B");
    await db.insert(session).values({
      id: `s-${alice.userId}`,
      token: `t-${alice.userId}`,
      userId: alice.userId,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await db.insert(account).values({
      id: `a-${alice.userId}`,
      accountId: alice.userId,
      providerId: "credential",
      userId: alice.userId,
      password: "hash",
    });

    await deleteAccount(alice);

    expect(await db.select().from(user).where(eq(user.id, alice.userId))).toHaveLength(0);
    expect(await db.select().from(userProfiles).where(eq(userProfiles.userId, alice.userId))).toHaveLength(0);
    expect(await db.select().from(meals).where(eq(meals.userId, alice.userId))).toHaveLength(0);
    expect(await db.select().from(mealEntries).where(eq(mealEntries.userId, alice.userId))).toHaveLength(0);
    expect(await db.select().from(foods).where(eq(foods.id, aliceData.food.id))).toHaveLength(0);
    expect(await db.select().from(recipes).where(eq(recipes.id, aliceData.recipe.id))).toHaveLength(0);
    expect(await db.select().from(session).where(eq(session.userId, alice.userId))).toHaveLength(0);
    expect(await db.select().from(account).where(eq(account.userId, alice.userId))).toHaveLength(0);

    // Bob is untouched.
    expect(await db.select().from(meals).where(eq(meals.userId, bob.userId))).toHaveLength(4);
    expect(await db.select().from(mealEntries).where(eq(mealEntries.userId, bob.userId))).toHaveLength(1);
    expect(await db.select().from(foods).where(eq(foods.id, bobData.food.id))).toHaveLength(1);
    expect(
      await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, bobData.recipe.id)),
    ).toHaveLength(1);
  });

  it("throws NOT_FOUND when the user no longer exists", async () => {
    await expect(deleteAccount({ db, userId: "gone", timezone: "Europe/Berlin" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
