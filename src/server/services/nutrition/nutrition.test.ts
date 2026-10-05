import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import { createTestEntry, createTestFood, createTestGoalProfile, type TestFood } from "@/test/factories";
import type { Db } from "@/server/db/create";
import type { ServiceContext } from "@/server/context";
import {
  activities,
  dailyNutrition,
  goalProfiles,
  mealEntries,
  meals,
  userProfiles,
} from "@/server/db/schema";
import { addDays, todayInTimezone } from "@/lib/dates";
import {
  ensureDailyNutrition,
  getDailyTargets,
  getDailyTotals,
  getDaySummary,
  getLoggedDates,
  refreshTargetsFrom,
  setDayProfile,
} from "./index";

let db: Db;
let oats: TestFood; // 100 g: 372 kcal, 13.5 P, 58.7 C, 7 F, 10 fiber, 1.2 sugar, serving 40 g
let skyr: TestFood; // 100 g: 63 kcal, 11 P, 4 C, 0.2 F, fiber unknown
let apple: TestFood; // 100 g: 52 kcal, 0.3 P, 14 C, 0.2 F, 2.4 fiber, serving 150 g

beforeAll(async () => {
  db = await createTestDb();
  oats = await createTestFood(db, {
    name: "Haferflocken",
    kcal: 372,
    proteinG: 13.5,
    carbsG: 58.7,
    fatG: 7,
    fiberG: 10,
    sugarG: 1.2,
    servings: [
      { label: "1 Portion (40 g)", amount: 1, unit: "serving", grams: 40, isDefault: true, sortOrder: 1 },
    ],
  });
  skyr = await createTestFood(db, {
    name: "Skyr",
    kcal: 63,
    proteinG: 11,
    carbsG: 4,
    fatG: 0.2,
    servings: [],
  });
  apple = await createTestFood(db, {
    name: "Apfel",
    kcal: 52,
    proteinG: 0.3,
    carbsG: 14,
    fatG: 0.2,
    fiberG: 2.4,
    servings: [
      { label: "1 Apfel (150 g)", amount: 1, unit: "piece", grams: 150, isDefault: true, sortOrder: 1 },
    ],
  });
});

const todayOf = (ctx: ServiceContext) => todayInTimezone(ctx.timezone);

async function setCalories(ctx: ServiceContext, profileId: string, calorieTarget: number) {
  await ctx.db
    .update(goalProfiles)
    .set({ calorieTarget })
    .where(and(eq(goalProfiles.id, profileId), eq(goalProfiles.userId, ctx.userId)));
}

async function snapshotRows(ctx: ServiceContext) {
  return ctx.db.select().from(dailyNutrition).where(eq(dailyNutrition.userId, ctx.userId));
}

describe("getDaySummary", () => {
  it("groups a multi-meal day by meal slot with exact (unrounded) totals", async () => {
    const ctx = await createTestUser(db);
    await createTestGoalProfile(ctx, {
      calorieTarget: 2000,
      proteinG: 150,
      carbsG: 200,
      fatG: 67,
      fiberG: 30,
    });
    const date = todayOf(ctx);
    // 1.5 × 40 g oats = 60 g → 223.2 kcal, 8.1 P, 35.22 C, 4.2 F, 6 fiber, 0.72 sugar
    await createTestEntry(ctx, { mealId: ctx.mealIds.breakfast, date, food: oats, quantity: 1.5 });
    // 250 g skyr → 157.5 kcal, 27.5 P, 10 C, 0.5 F, fiber unknown
    await createTestEntry(ctx, { mealId: ctx.mealIds.breakfast, date, food: skyr, quantity: 2.5 });
    // 1 apple 150 g → 78 kcal, 0.45 P, 21 C, 0.3 F, 3.6 fiber
    await createTestEntry(ctx, { mealId: ctx.mealIds.snacks, date, food: apple });

    const s = await getDaySummary(ctx, date);

    expect(s.date).toBe(date);
    expect(s.entryCount).toBe(3);
    expect(s.meals.map((m) => m.meal.name)).toEqual(["Frühstück", "Mittagessen", "Abendessen", "Snacks"]);
    const [breakfast, lunch, , snacks] = s.meals;
    expect(breakfast.entries.map((e) => e.foodName)).toEqual(["Haferflocken", "Skyr"]);
    expect(breakfast.entries[0]).toMatchObject({ grams: 60, quantity: 1.5, servingGrams: 40 });
    expect(breakfast.totals.kcal).toBeCloseTo(380.7, 9);
    expect(breakfast.totals.proteinG).toBeCloseTo(35.6, 9);
    expect(breakfast.totals.fiberG).toBeCloseTo(6, 9); // skyr's unknown fiber is not a 0 guess, just not added
    expect(lunch.entries).toEqual([]);
    expect(lunch.totals).toMatchObject({ kcal: 0, proteinG: 0, fiberG: null });
    expect(snacks.totals.kcal).toBeCloseTo(78, 9);

    expect(s.consumed.kcal).toBeCloseTo(458.7, 9);
    expect(s.consumed.proteinG).toBeCloseTo(36.05, 9);
    expect(s.consumed.carbsG).toBeCloseTo(66.22, 9);
    expect(s.consumed.fatG).toBeCloseTo(5, 9);
    expect(s.consumed.fiberG).toBeCloseTo(9.6, 9);
    expect(s.consumed.sugarG).toBeCloseTo(0.72, 9);

    expect(s.targets).toMatchObject({
      calories: 2000,
      proteinG: 150,
      fiberG: 30,
      goalProfileName: "Standard",
    });
    expect(s.activityKcal).toBe(0);
    expect(s.remaining?.kcal).toBeCloseTo(2000 - 458.7, 9);
    expect(s.remaining?.fiberG).toBeCloseTo(20.4, 9);
    expect(s.status).toEqual({
      kcal: "under",
      protein: "under",
      carbs: "under",
      fat: "under",
      fiber: "under",
    });
  });

  it("orders entries by sortOrder, then loggedAt", async () => {
    const ctx = await createTestUser(db);
    const date = "2026-03-02";
    const t = (h: number) => new Date(`2026-03-02T0${h}:00:00Z`);
    await createTestEntry(ctx, {
      mealId: ctx.mealIds.lunch,
      date,
      food: skyr,
      overrides: { sortOrder: 1, loggedAt: t(1) },
    });
    await createTestEntry(ctx, {
      mealId: ctx.mealIds.lunch,
      date,
      food: apple,
      overrides: { sortOrder: 0, loggedAt: t(3) },
    });
    await createTestEntry(ctx, {
      mealId: ctx.mealIds.lunch,
      date,
      food: oats,
      overrides: { sortOrder: 0, loggedAt: t(2) },
    });
    const s = await getDaySummary(ctx, date);
    expect(s.meals[1].entries.map((e) => e.foodName)).toEqual(["Haferflocken", "Apfel", "Skyr"]);
  });

  it("keeps optional nutrients null when every entry leaves them unknown", async () => {
    const ctx = await createTestUser(db);
    const date = "2026-03-03";
    await createTestEntry(ctx, { mealId: ctx.mealIds.dinner, date, food: skyr, quantity: 2 });
    await createTestEntry(ctx, {
      mealId: ctx.mealIds.dinner,
      date,
      overrides: { kcal: 120, proteinG: 3, carbsG: 20, fatG: 3 },
    });
    const s = await getDaySummary(ctx, date);
    expect(s.consumed).toMatchObject({ fiberG: null, sugarG: null, saturatedFatG: null, sodiumMg: null });
    expect(s.consumed.kcal).toBeCloseTo(246, 9);
    // SQL aggregate agrees with the in-memory sum
    const [row] = await getDailyTotals(ctx, date, date);
    expect(row.totals).toMatchObject({ fiberG: null, sugarG: null, saturatedFatG: null, sodiumMg: null });
    expect(row.totals.kcal).toBeCloseTo(246, 9);
  });

  it("returns null targets/remaining/status without a goal profile, but still sums", async () => {
    const ctx = await createTestUser(db);
    const date = todayOf(ctx);
    await createTestEntry(ctx, { mealId: ctx.mealIds.breakfast, date, food: apple });
    const s = await getDaySummary(ctx, date);
    expect(s.targets).toBeNull();
    expect(s.remaining).toBeNull();
    expect(s.status).toBeNull();
    expect(s.consumed.kcal).toBeCloseTo(78, 9);
  });

  it("shows archived meal slots only on days they hold entries", async () => {
    const ctx = await createTestUser(db);
    const [late] = await ctx.db
      .insert(meals)
      .values({ userId: ctx.userId, name: "Spätmahlzeit", sortOrder: 9 })
      .returning();
    await createTestEntry(ctx, { mealId: late.id, date: "2026-03-04", food: apple });
    await ctx.db.update(meals).set({ isArchived: true }).where(eq(meals.id, late.id));

    const withEntries = await getDaySummary(ctx, "2026-03-04");
    expect(withEntries.meals.map((m) => m.meal.name)).toEqual([
      "Frühstück",
      "Mittagessen",
      "Abendessen",
      "Snacks",
      "Spätmahlzeit",
    ]);
    expect(withEntries.meals[4].meal.isArchived).toBe(true);
    expect(withEntries.meals[4].totals.kcal).toBeCloseTo(78, 9);

    const without = await getDaySummary(ctx, "2026-03-05");
    expect(without.meals).toHaveLength(4);
    expect(without.entryCount).toBe(0);
  });

  it("adds activity calories to the budget only when the user opted in", async () => {
    const ctx = await createTestUser(db);
    await createTestGoalProfile(ctx, { calorieTarget: 2000 });
    const date = todayOf(ctx);
    await createTestEntry(ctx, {
      mealId: ctx.mealIds.lunch,
      date,
      overrides: { kcal: 1900, proteinG: 100, carbsG: 200, fatG: 60 },
    });
    await ctx.db.insert(activities).values([
      { userId: ctx.userId, date, type: "cardio", name: "Laufen", caloriesBurned: 300 },
      { userId: ctx.userId, date, type: "steps", name: "Schritte", steps: 9000, caloriesBurned: 200.5 },
      { userId: ctx.userId, date, type: "strength", name: "Kraft" }, // unknown kcal
      { userId: ctx.userId, date: addDays(date, -1), type: "cardio", name: "Gestern", caloriesBurned: 999 },
    ]);

    const off = await getDaySummary(ctx, date);
    expect(off.activityKcal).toBe(0);
    expect(off.remaining?.kcal).toBeCloseTo(100, 9);
    expect(off.status?.kcal).toBe("near"); // 1900 / 2000 = 95 %

    await ctx.db
      .update(userProfiles)
      .set({ addActivityCalories: true })
      .where(eq(userProfiles.userId, ctx.userId));
    const on = await getDaySummary(ctx, date);
    expect(on.activityKcal).toBeCloseTo(500.5, 9);
    expect(on.remaining?.kcal).toBeCloseTo(600.5, 9);
    expect(on.status?.kcal).toBe("under"); // 1900 / 2500.5 = 76 %
    expect(on.targets?.calories).toBe(2000); // the target itself is unchanged
  });

  it("rejects malformed dates with a VALIDATION error", async () => {
    const ctx = await createTestUser(db);
    await expect(getDaySummary(ctx, "2026-02-31")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(getDaySummary(ctx, "heute")).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("targets & daily_nutrition snapshot", () => {
  it("ensureDailyNutrition is idempotent and writes nothing without a goal profile", async () => {
    const ctx = await createTestUser(db);
    const date = todayOf(ctx);
    expect(await ensureDailyNutrition(ctx, date)).toBeNull();
    expect(await snapshotRows(ctx)).toHaveLength(0);

    const profile = await createTestGoalProfile(ctx, { calorieTarget: 2100, fiberG: 30 });
    const first = await ensureDailyNutrition(ctx, date);
    const second = await ensureDailyNutrition(ctx, date);
    expect(first).toEqual(second);
    const rows = await snapshotRows(ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date,
      goalProfileId: profile.id,
      profileOverridden: false,
      targetCalories: 2100,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 67,
      targetFiberG: 30,
    });
  });

  it("keeps a past day's snapshot when goals change later", async () => {
    const ctx = await createTestUser(db);
    const profile = await createTestGoalProfile(ctx, { calorieTarget: 2000 });
    const past = addDays(todayOf(ctx), -3);
    await createTestEntry(ctx, { mealId: ctx.mealIds.lunch, date: past, food: apple });
    await ensureDailyNutrition(ctx, past);

    await setCalories(ctx, profile.id, 2500);
    const res = await refreshTargetsFrom(ctx, past); // even an explicit past fromDate is clamped to today
    expect(res.updated).toBe(0);
    await ensureDailyNutrition(ctx, past); // logging on a past day again doesn't re-snapshot

    expect((await getDailyTargets(ctx, past))?.calories).toBe(2000);
    expect((await getDaySummary(ctx, past)).targets?.calories).toBe(2000);
    expect((await getDailyTotals(ctx, past, past))[0].targets?.calories).toBe(2000);
  });

  it("snapshots a past day without a row once with the current targets", async () => {
    const ctx = await createTestUser(db);
    await createTestGoalProfile(ctx, { calorieTarget: 1800 });
    const past = addDays(todayOf(ctx), -10);
    expect((await getDailyTargets(ctx, past))?.calories).toBe(1800); // no snapshot → live fallback
    expect((await ensureDailyNutrition(ctx, past))?.calories).toBe(1800);
    expect(await snapshotRows(ctx)).toHaveLength(1);
  });

  it("today and future days follow goal changes", async () => {
    const ctx = await createTestUser(db);
    const profile = await createTestGoalProfile(ctx, { calorieTarget: 2000 });
    const today = todayOf(ctx);
    const tomorrow = addDays(today, 1);
    await ensureDailyNutrition(ctx, today);
    await ensureDailyNutrition(ctx, tomorrow);

    await setCalories(ctx, profile.id, 2300);
    // live read reflects the change immediately, even before the refresh
    expect((await getDailyTargets(ctx, today))?.calories).toBe(2300);

    const res = await refreshTargetsFrom(ctx);
    expect(res.updated).toBe(2);
    const rows = await snapshotRows(ctx);
    expect(rows.map((r) => r.targetCalories)).toEqual([2300, 2300]);
    expect((await refreshTargetsFrom(ctx)).updated).toBe(0); // nothing left to change
  });

  it("setDayProfile overrides a single date and can be cleared", async () => {
    const ctx = await createTestUser(db);
    const standard = await createTestGoalProfile(ctx, { calorieTarget: 2000 });
    const training = await createTestGoalProfile(ctx, {
      name: "Trainingstag",
      kind: "training",
      calorieTarget: 2600,
      proteinG: 170,
      carbsG: 300,
      fatG: 70,
    });
    const today = todayOf(ctx);
    const tomorrow = addDays(today, 1);

    const t = await setDayProfile(ctx, today, training.id);
    expect(t).toMatchObject({ calories: 2600, goalProfileId: training.id, goalProfileName: "Trainingstag" });
    expect((await getDaySummary(ctx, today)).targets?.calories).toBe(2600);
    expect((await getDailyTargets(ctx, tomorrow))?.calories).toBe(2000); // only that date

    // editing the chosen profile flows into the (current) overridden day
    await setCalories(ctx, training.id, 2700);
    await refreshTargetsFrom(ctx);
    const [row] = await snapshotRows(ctx);
    expect(row).toMatchObject({ profileOverridden: true, goalProfileId: training.id, targetCalories: 2700 });

    const cleared = await setDayProfile(ctx, today, null);
    expect(cleared).toMatchObject({ calories: 2000, goalProfileId: standard.id });
    const [after] = await snapshotRows(ctx);
    expect(after).toMatchObject({
      profileOverridden: false,
      goalProfileId: standard.id,
      targetCalories: 2000,
    });
    // clearing a date that never had a row is a no-op returning the live targets
    expect((await setDayProfile(ctx, tomorrow, null))?.calories).toBe(2000);
    expect(await snapshotRows(ctx)).toHaveLength(1);
  });

  it("setDayProfile can re-assign a past day explicitly; later goal edits don't touch it", async () => {
    const ctx = await createTestUser(db);
    await createTestGoalProfile(ctx, { calorieTarget: 2000 });
    const rest = await createTestGoalProfile(ctx, { name: "Ruhetag", kind: "rest", calorieTarget: 1700 });
    const past = addDays(todayOf(ctx), -2);
    await ensureDailyNutrition(ctx, past);
    await setDayProfile(ctx, past, rest.id);
    await setCalories(ctx, rest.id, 1500);
    await refreshTargetsFrom(ctx);
    expect(await getDailyTargets(ctx, past)).toMatchObject({ calories: 1700, goalProfileName: "Ruhetag" });
  });

  it("falls back to the resolved profile when the overridden profile is deleted", async () => {
    const ctx = await createTestUser(db);
    await createTestGoalProfile(ctx, { calorieTarget: 2000 });
    const refeed = await createTestGoalProfile(ctx, { name: "Refeed", kind: "refeed", calorieTarget: 3000 });
    const today = todayOf(ctx);
    await setDayProfile(ctx, today, refeed.id);
    await ctx.db.delete(goalProfiles).where(eq(goalProfiles.id, refeed.id));
    expect((await getDailyTargets(ctx, today))?.calories).toBe(2000);
    await refreshTargetsFrom(ctx);
    const [row] = await snapshotRows(ctx);
    expect(row).toMatchObject({ profileOverridden: false, targetCalories: 2000 });
  });

  it("setDayProfile rejects foreign, archived and malformed profile ids", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    await createTestGoalProfile(alice);
    const bobs = await createTestGoalProfile(bob);
    const archived = await createTestGoalProfile(alice, {
      name: "Alt",
      kind: "custom",
      archivedAt: new Date(),
    });
    const today = todayOf(alice);
    await expect(setDayProfile(alice, today, bobs.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setDayProfile(alice, today, archived.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setDayProfile(alice, today, "kein-uuid")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await snapshotRows(alice)).toHaveLength(0);
  });
});

describe("range queries", () => {
  it("getDailyTotals returns one row per logged day with snapshot targets", async () => {
    const ctx = await createTestUser(db);
    await createTestGoalProfile(ctx, { calorieTarget: 2000 });
    await createTestEntry(ctx, { mealId: ctx.mealIds.breakfast, date: "2026-01-01", food: oats });
    await createTestEntry(ctx, { mealId: ctx.mealIds.snacks, date: "2026-01-01", food: apple });
    await createTestEntry(ctx, { mealId: ctx.mealIds.lunch, date: "2026-01-03", food: skyr });
    await ensureDailyNutrition(ctx, "2026-01-01");

    const rows = await getDailyTotals(ctx, "2026-01-01", "2026-01-31");
    expect(rows.map((r) => r.date)).toEqual(["2026-01-01", "2026-01-03"]);
    expect(rows[0].entryCount).toBe(2);
    expect(rows[0].totals.kcal).toBeCloseTo(148.8 + 78, 9);
    expect(rows[0].totals.fiberG).toBeCloseTo(4 + 3.6, 9);
    expect(rows[0].targets).toMatchObject({ calories: 2000, goalProfileName: "Standard" });
    expect(rows[1].targets).toBeNull(); // no snapshot for that day
    expect(rows[1].totals.fiberG).toBeNull();

    expect(await getLoggedDates(ctx, "2026-01-01", "2026-01-02")).toEqual(["2026-01-01"]);
    expect(await getDailyTotals(ctx, "2026-02-01", "2026-01-01")).toEqual([]);
  });

  it("never leaks another user's data", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    await createTestGoalProfile(alice, { calorieTarget: 2000 });
    await createTestGoalProfile(bob, { calorieTarget: 3000 });
    const date = todayOf(alice);
    await createTestEntry(alice, { mealId: alice.mealIds.lunch, date, food: apple });
    await createTestEntry(bob, { mealId: bob.mealIds.lunch, date, food: oats, quantity: 3 });
    await createTestEntry(bob, { mealId: bob.mealIds.lunch, date: "2026-01-05", food: oats });
    await bob.db
      .insert(activities)
      .values({ userId: bob.userId, date, type: "cardio", name: "Rad", caloriesBurned: 400 });
    await alice.db
      .update(userProfiles)
      .set({ addActivityCalories: true })
      .where(eq(userProfiles.userId, alice.userId));
    await ensureDailyNutrition(bob, date);

    const s = await getDaySummary(alice, date);
    expect(s.entryCount).toBe(1);
    expect(s.consumed.kcal).toBeCloseTo(78, 9);
    expect(s.activityKcal).toBe(0);
    expect(s.targets?.calories).toBe(2000);
    expect(await getLoggedDates(alice, "2026-01-01", date)).toEqual([date]);
    const totals = await getDailyTotals(alice, "2026-01-01", date);
    expect(totals).toHaveLength(1);
    expect(totals[0].targets).toBeNull(); // bob's snapshot for the same date is not joined
    expect(await snapshotRows(alice)).toHaveLength(0);
  });

  it("aggregates a year of data in one fast query", async () => {
    const ctx = await createTestUser(db);
    await createTestGoalProfile(ctx, { calorieTarget: 2000 });
    const start = "2025-01-01";
    const slots = Object.values(ctx.mealIds);
    const values: (typeof mealEntries.$inferInsert)[] = [];
    for (let d = 0; d < 365; d++) {
      const date = addDays(start, d);
      for (const [i, mealId] of slots.entries()) {
        values.push({
          userId: ctx.userId,
          date,
          mealId,
          foodName: `Eintrag ${i}`,
          servingLabel: "100 g",
          servingGrams: 100,
          quantity: 1,
          grams: 100,
          kcal: 500.25,
          proteinG: 30.1,
          carbsG: 55,
          fatG: 17.3,
          fiberG: i % 2 === 0 ? 4 : null,
        });
      }
    }
    for (let i = 0; i < values.length; i += 500)
      await ctx.db.insert(mealEntries).values(values.slice(i, i + 500));
    await ctx.db.insert(dailyNutrition).values(
      Array.from({ length: 365 }, (_, d) => ({
        userId: ctx.userId,
        date: addDays(start, d),
        targetCalories: 2000,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 67,
      })),
    );

    await getDailyTotals(ctx, start, "2025-12-31"); // warm-up
    const t0 = performance.now();
    const rows = await getDailyTotals(ctx, start, "2025-12-31");
    const ms = performance.now() - t0;

    expect(rows).toHaveLength(365);
    expect(rows[100].entryCount).toBe(4);
    expect(rows[100].totals.kcal).toBeCloseTo(2001, 9);
    expect(rows[100].totals.fiberG).toBeCloseTo(8, 9);
    expect(rows[364].targets?.calories).toBe(2000);
    expect(rows.reduce((s, r) => s + r.totals.kcal, 0)).toBeCloseTo(2001 * 365, 6);
    expect(await getLoggedDates(ctx, start, "2025-12-31")).toHaveLength(365);
    // In-memory PGlite (WASM) is far slower than Postgres; this guards against N+1 regressions.
    expect(ms).toBeLessThan(1000);
  });
});
