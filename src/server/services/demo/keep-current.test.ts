import { beforeAll, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import type { Db } from "@/server/db/create";
import { dailyNutrition, mealEntries, waterEntries, weightEntries } from "@/server/db/schema";
import { keepDemoDataCurrent } from "./keep-current";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

async function seedDiary(ctx: Awaited<ReturnType<typeof createTestUser>>, days: string[]) {
  for (const date of days) {
    await db.insert(mealEntries).values({
      userId: ctx.userId,
      date,
      mealId: ctx.mealIds.breakfast,
      foodName: "Haferflocken",
      servingLabel: "100 g",
      servingGrams: 100,
      quantity: 1,
      grams: 100,
      kcal: 379,
      proteinG: 13,
      carbsG: 68,
      fatG: 7,
    });
    await db.insert(dailyNutrition).values({
      userId: ctx.userId,
      date,
      targetCalories: 2300,
      targetProteinG: 160,
      targetCarbsG: 258,
      targetFatG: 70,
    });
    await db.insert(weightEntries).values({ userId: ctx.userId, date, weightKg: 84 });
    await db.insert(waterEntries).values({ userId: ctx.userId, date, amountMl: 500 });
  }
}

const datesOf = async (table: typeof mealEntries | typeof dailyNutrition | typeof weightEntries | typeof waterEntries, userId: string) =>
  (await db.select({ d: table.date }).from(table).where(eq(table.userId, userId)).orderBy(asc(table.date))).map((r) => r.d);

describe("keepDemoDataCurrent", () => {
  it("moves the whole diary so the latest logged day becomes today, keeping gaps", async () => {
    const ctx = await createTestUser(db);
    await seedDiary(ctx, ["2026-10-01", "2026-10-02", "2026-10-04"]);

    expect(await keepDemoDataCurrent(ctx, "2026-10-08")).toBe(4);

    const expected = ["2026-10-05", "2026-10-06", "2026-10-08"];
    expect(await datesOf(mealEntries, ctx.userId)).toEqual(expected);
    expect(await datesOf(dailyNutrition, ctx.userId)).toEqual(expected);
    expect(await datesOf(weightEntries, ctx.userId)).toEqual(expected);
    expect(await datesOf(waterEntries, ctx.userId)).toEqual(expected);
  });

  it("is idempotent and leaves other users alone", async () => {
    const demo = await createTestUser(db);
    const other = await createTestUser(db);
    await seedDiary(demo, ["2026-10-03", "2026-10-04"]);
    await seedDiary(other, ["2026-10-03"]);

    const results = await Promise.all([keepDemoDataCurrent(demo, "2026-10-05"), keepDemoDataCurrent(demo, "2026-10-05")]);
    expect(results.sort()).toEqual([0, 1]);
    expect(await keepDemoDataCurrent(demo, "2026-10-05")).toBe(0);
    expect(await datesOf(mealEntries, demo.userId)).toEqual(["2026-10-04", "2026-10-05"]);
    expect(await datesOf(mealEntries, other.userId)).toEqual(["2026-10-03"]);
  });

  it("does nothing for an empty diary or when today is already logged", async () => {
    const empty = await createTestUser(db);
    expect(await keepDemoDataCurrent(empty, "2026-10-05")).toBe(0);

    const current = await createTestUser(db);
    await seedDiary(current, ["2026-10-05", "2026-10-07"]); // a future entry does not count
    expect(await keepDemoDataCurrent(current, "2026-10-05")).toBe(0);
  });
});
