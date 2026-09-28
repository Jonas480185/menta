import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createTestUser } from "@/test/db";
import { createTestFood, createTestGoalProfile } from "@/test/factories";
import type { Db } from "@/server/db/create";
import { addEntry, copyEntries, deleteEntry, restoreEntry, updateEntry } from "./index";
import { getDaySummary } from "@/server/services/nutrition";
import { getQuickPicks, searchFoods, toggleFavorite } from "@/server/services/foods";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

const DATE = "2026-03-02";

describe("meal logging", () => {
  it("adds, edits, deletes, restores and copies entries with correct nutrition", async () => {
    const ctx = await createTestUser(db);
    await createTestGoalProfile(ctx, { isDefault: true, calorieTarget: 2000, proteinG: 150, carbsG: 200, fatG: 67 });
    const oats = await createTestFood(db, { name: "Haferflocken", kcal: 372, proteinG: 13.5, carbsG: 58.7, fatG: 7 });
    const portion = oats.servings.find((s) => s.grams === 30)!;

    const e = await addEntry(ctx, { date: DATE, mealId: ctx.mealIds.breakfast, foodId: oats.id, servingId: portion.id, quantity: 2 });
    expect(e.grams).toBe(60);
    expect(e.kcal).toBeCloseTo(223.2, 5);

    let day = await getDaySummary(ctx, DATE);
    expect(day.consumed.kcal).toBeCloseTo(223.2, 5);
    expect(day.targets?.calories).toBe(2000);

    await updateEntry(ctx, e.id, { quantity: 1 });
    day = await getDaySummary(ctx, DATE);
    expect(day.consumed.proteinG).toBeCloseTo(4.05, 5);

    const removed = await deleteEntry(ctx, e.id);
    expect((await getDaySummary(ctx, DATE)).entryCount).toBe(0);
    await restoreEntry(ctx, removed);
    expect((await getDaySummary(ctx, DATE)).entryCount).toBe(1);

    expect(await copyEntries(ctx, { date: DATE }, { date: "2026-03-03" })).toBe(1);
    expect((await getDaySummary(ctx, "2026-03-03")).consumed.kcal).toBeCloseTo(111.6, 5);
  });

  it("records usage for quick picks and ranks history first", async () => {
    const ctx = await createTestUser(db);
    const a = await createTestFood(db, { name: "Skyr Natur", kcal: 63, proteinG: 11, carbsG: 4, fatG: 0.2 });
    await createTestFood(db, { name: "Skyr Vanille", kcal: 80, proteinG: 10, carbsG: 9, fatG: 0.2 });
    await addEntry(ctx, { date: DATE, mealId: ctx.mealIds.snacks, foodId: a.id, servingId: null, quantity: 1.5 });

    const picks = await getQuickPicks(ctx);
    expect(picks[0]).toMatchObject({ id: a.id, section: "recent" });

    const res = await searchFoods(ctx, "skyr", { includeExternal: false });
    expect(res.items[0].id).toBe(a.id);
    expect(await toggleFavorite(ctx, a.id)).toBe(true);
  });

  it("rejects foreign meals", async () => {
    const ctx = await createTestUser(db);
    const other = await createTestUser(db);
    const f = await createTestFood(db);
    await expect(
      addEntry(ctx, { date: DATE, mealId: other.mealIds.lunch, foodId: f.id, servingId: null, quantity: 1 }),
    ).rejects.toThrow(/Mahlzeit/);
  });
});
