import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import { createTestWeightEntry } from "@/test/factories";
import type { Db } from "@/server/db/create";
import { activities } from "@/server/db/schema";
import { getDaySummary } from "@/server/services/nutrition";
import {
  addActivity,
  deleteActivity,
  getActivitySummary,
  listActivities,
  setAddActivityCalories,
  setDailySteps,
  setStepGoal,
  updateActivity,
} from "./index";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

const DAY = "2026-09-20";

describe("addActivity", () => {
  it("estimates net kcal from MET and the latest weight entry", async () => {
    const ctx = await createTestUser(db, { startWeightKg: 90 });
    await createTestWeightEntry(ctx, { date: "2026-01-01", weightKg: 70 });
    const entry = await addActivity(ctx, { date: DAY, metKey: "running_10", durationMin: 30 });
    expect(entry).toMatchObject({
      name: "Laufen (10 km/h)",
      type: "cardio",
      source: "manual",
      metKey: "running_10",
      kcalEstimated: true,
      durationMin: 30,
    });
    expect(entry.caloriesBurned).toBeCloseTo(308, 6); // (9.8 − 1) × 70 × 0.5
  });

  it("falls back to the start weight, then 70 kg", async () => {
    const withStart = await createTestUser(db, { startWeightKg: 80 });
    const a = await addActivity(withStart, { date: DAY, metKey: "walking", durationMin: 60 });
    expect(a.caloriesBurned).toBeCloseTo(200, 6); // 2.5 × 80
    const none = await createTestUser(db);
    const b = await addActivity(none, { date: DAY, metKey: "walking", durationMin: 60 });
    expect(b.caloriesBurned).toBeCloseTo(175, 6); // 2.5 × 70
  });

  it("uses given kcal as override and keeps a note", async () => {
    const ctx = await createTestUser(db);
    const entry = await addActivity(ctx, {
      date: DAY,
      metKey: "yoga",
      durationMin: 45,
      caloriesBurned: 120,
      note: "  Abendkurs ",
    });
    expect(entry).toMatchObject({
      caloriesBurned: 120,
      kcalEstimated: false,
      note: "Abendkurs",
      type: "other",
    });
  });

  it("supports custom activities with name + kcal", async () => {
    const ctx = await createTestUser(db);
    const entry = await addActivity(ctx, {
      date: DAY,
      name: "Klettern",
      durationMin: 90,
      caloriesBurned: 450,
    });
    expect(entry).toMatchObject({ name: "Klettern", type: "other", metKey: null, caloriesBurned: 450 });
  });

  it("rejects invalid input with fieldErrors", async () => {
    const ctx = await createTestUser(db);
    await expect(addActivity(ctx, { date: DAY, name: "Klettern", durationMin: 30 })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { caloriesBurned: expect.any(Array) },
    });
    await expect(
      addActivity(ctx, { date: "gestern", metKey: "yoga", durationMin: 30 }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("updateActivity", () => {
  it("re-estimates when the duration of an estimated activity changes", async () => {
    const ctx = await createTestUser(db, { startWeightKg: 80 });
    const entry = await addActivity(ctx, { date: DAY, metKey: "walking", durationMin: 60 });
    const updated = await updateActivity(ctx, { id: entry.id, durationMin: 30 });
    expect(updated.caloriesBurned).toBeCloseTo(100, 6);
    expect(updated.kcalEstimated).toBe(true);
  });

  it("override sticks when the duration changes later; null re-estimates", async () => {
    const ctx = await createTestUser(db, { startWeightKg: 80 });
    const entry = await addActivity(ctx, { date: DAY, metKey: "walking", durationMin: 60 });
    const overridden = await updateActivity(ctx, { id: entry.id, caloriesBurned: 300 });
    expect(overridden).toMatchObject({ caloriesBurned: 300, kcalEstimated: false });
    const longer = await updateActivity(ctx, { id: entry.id, durationMin: 90 });
    expect(longer.caloriesBurned).toBe(300);
    const reset = await updateActivity(ctx, { id: entry.id, caloriesBurned: null });
    expect(reset.caloriesBurned).toBeCloseTo(300, 6); // 2.5 × 80 × 1.5
    expect(reset.kcalEstimated).toBe(true);
  });

  it("updates name and clears the note", async () => {
    const ctx = await createTestUser(db);
    const entry = await addActivity(ctx, { date: DAY, metKey: "yoga", durationMin: 30, note: "x" });
    const updated = await updateActivity(ctx, { id: entry.id, name: "Yin Yoga", note: null });
    expect(updated).toMatchObject({ name: "Yin Yoga", note: null });
  });

  it("cannot re-estimate a custom activity", async () => {
    const ctx = await createTestUser(db);
    const entry = await addActivity(ctx, {
      date: DAY,
      name: "Klettern",
      durationMin: 60,
      caloriesBurned: 400,
    });
    await expect(updateActivity(ctx, { id: entry.id, caloriesBurned: null })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("deleteActivity / listActivities", () => {
  it("lists only the day's rows and deletes by id", async () => {
    const ctx = await createTestUser(db);
    const a = await addActivity(ctx, { date: DAY, metKey: "yoga", durationMin: 30 });
    const b = await addActivity(ctx, { date: DAY, metKey: "hiit", durationMin: 20 });
    await addActivity(ctx, { date: "2026-09-21", metKey: "tennis", durationMin: 60 });
    expect((await listActivities(ctx, DAY)).map((e) => e.id).sort()).toEqual([a.id, b.id].sort());

    const deleted = await deleteActivity(ctx, a.id);
    expect(deleted.id).toBe(a.id);
    expect((await listActivities(ctx, DAY)).map((e) => e.id)).toEqual([b.id]);
    await expect(deleteActivity(ctx, a.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("setDailySteps", () => {
  it("upserts exactly one manual steps row per day; 0 removes it", async () => {
    const ctx = await createTestUser(db);
    await setDailySteps(ctx, DAY, 4000);
    await setDailySteps(ctx, DAY, 6500);
    const rows = await db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, ctx.userId), eq(activities.type, "steps")));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ steps: 6500, caloriesBurned: null, source: "manual", date: DAY });

    await setDailySteps(ctx, DAY, 0);
    expect((await listActivities(ctx, DAY)).length).toBe(0);
  });

  it("validates the step count", async () => {
    const ctx = await createTestUser(db);
    await expect(setDailySteps(ctx, DAY, -1)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setDailySteps(ctx, DAY, 12.5)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("getActivitySummary", () => {
  it("returns zeros and the defaults for an empty day", async () => {
    const ctx = await createTestUser(db);
    const s = await getActivitySummary(ctx, DAY);
    expect(s).toMatchObject({
      activeKcal: 0,
      steps: 0,
      stepGoal: 8000,
      minutes: 0,
      entries: [],
      addActivityCalories: false,
      stepsKcalEstimate: 0,
      weightKg: 70,
      weightIsFallback: true,
    });
  });

  it("aggregates activities and steps of the day", async () => {
    const ctx = await createTestUser(db, { startWeightKg: 80, stepGoal: 10000 });
    await addActivity(ctx, { date: DAY, metKey: "walking", durationMin: 60 }); // 200 kcal
    await addActivity(ctx, { date: DAY, name: "Klettern", durationMin: 30, caloriesBurned: 150 });
    await setDailySteps(ctx, DAY, 9000);
    const s = await getActivitySummary(ctx, DAY);
    expect(s.activeKcal).toBeCloseTo(350, 6);
    expect(s).toMatchObject({
      steps: 9000,
      stepGoal: 10000,
      minutes: 90,
      weightKg: 80,
      weightIsFallback: false,
    });
    expect(s.entries.map((e) => e.name).sort()).toEqual(["Gehen", "Klettern"]);
    expect(s.stepsKcalEstimate).toBeCloseTo(2.5 * 80 * (90 / 60), 6);
  });

  it("activeKcal matches what the daily budget adds when the toggle is on", async () => {
    const ctx = await createTestUser(db, { startWeightKg: 80 });
    await addActivity(ctx, { date: DAY, metKey: "walking", durationMin: 60 });
    await setDailySteps(ctx, DAY, 12000);
    expect(await setAddActivityCalories(ctx, true)).toBe(true);
    const [activity, day] = await Promise.all([getActivitySummary(ctx, DAY), getDaySummary(ctx, DAY)]);
    expect(activity.addActivityCalories).toBe(true);
    expect(day.activityKcal).toBeCloseTo(activity.activeKcal, 6);
    expect(activity.activeKcal).toBeCloseTo(200, 6); // steps carry no kcal
  });
});

describe("settings", () => {
  it("sets the step goal with validation", async () => {
    const ctx = await createTestUser(db);
    expect(await setStepGoal(ctx, 12000)).toBe(12000);
    expect((await getActivitySummary(ctx, DAY)).stepGoal).toBe(12000);
    await expect(setStepGoal(ctx, -5)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("toggles addActivityCalories", async () => {
    const ctx = await createTestUser(db);
    expect(await setAddActivityCalories(ctx, true)).toBe(true);
    expect(await setAddActivityCalories(ctx, false)).toBe(false);
  });
});

describe("isolation", () => {
  it("never reads or touches another user's activities", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    const entry = await addActivity(alice, { date: DAY, metKey: "yoga", durationMin: 30 });
    await setDailySteps(alice, DAY, 5000);

    expect(await listActivities(bob, DAY)).toEqual([]);
    expect((await getActivitySummary(bob, DAY)).steps).toBe(0);
    await expect(updateActivity(bob, { id: entry.id, durationMin: 10 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteActivity(bob, entry.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await setDailySteps(bob, DAY, 100); // own row, alice's untouched
    expect((await getActivitySummary(alice, DAY)).steps).toBe(5000);
  });
});
