import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createTestUser } from "@/test/db";
import type { Db } from "@/server/db/create";
import { getActivitySummary, listActivities, setDailySteps } from "@/server/services/activity";
import {
  getActivityProvider,
  importActivities,
  listActivityProviderIds,
  listActivityProviders,
  registerActivityProvider,
  syncActivityProvider,
  type ActivityImportItem,
} from "./index";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

const DAY = "2026-09-20";
const run = (id: string, over: Partial<ActivityImportItem> = {}): ActivityImportItem => ({
  externalId: id,
  date: DAY,
  type: "cardio",
  name: "Laufen",
  durationMin: 30,
  distanceKm: 5,
  caloriesBurned: 320,
  startedAt: "2026-09-20T06:30:00+02:00",
  ...over,
});

describe("registry", () => {
  it("registers manual + the four wearable adapters", () => {
    expect(listActivityProviderIds()).toEqual([
      "manual",
      "apple_health",
      "health_connect",
      "garmin",
      "fitbit",
    ]);
  });

  it("manual is available; wearable skeletons are not, with a German reason and no data", async () => {
    const ctx = await createTestUser(db);
    const statuses = await listActivityProviders(ctx);
    expect(statuses.find((s) => s.id === "manual")?.availability).toEqual({ available: true });
    for (const id of ["apple_health", "health_connect", "garmin", "fitbit"] as const) {
      const p = getActivityProvider(ctx, id);
      const a = await p.isAvailable();
      expect(a.available).toBe(false);
      if (!a.available) expect(a.reason).toMatch(/manuell/);
      expect(await p.fetchActivities({ from: DAY, to: DAY })).toEqual([]);
      expect(await p.fetchDailySteps({ from: DAY, to: DAY })).toEqual([]);
    }
  });

  it("sync with an unavailable provider fails with EXTERNAL", async () => {
    const ctx = await createTestUser(db);
    await expect(syncActivityProvider(ctx, "garmin", { from: DAY, to: DAY })).rejects.toMatchObject({
      code: "EXTERNAL",
    });
  });
});

describe("importActivities", () => {
  it("is idempotent by externalId (insert, then update)", async () => {
    const ctx = await createTestUser(db);
    expect(await importActivities(ctx, "garmin", [run("g-1"), run("g-2")])).toEqual({
      inserted: 2,
      updated: 0,
    });
    expect(await importActivities(ctx, "garmin", [run("g-1", { caloriesBurned: 350 }), run("g-3")])).toEqual({
      inserted: 1,
      updated: 1,
    });

    const rows = await listActivities(ctx, DAY);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.caloriesBurned === 350)).toMatchObject({ source: "garmin", distanceKm: 5 });
  });

  it("same externalId from different sources are different rows", async () => {
    const ctx = await createTestUser(db);
    await importActivities(ctx, "garmin", [run("x")]);
    await importActivities(ctx, "fitbit", [run("x")]);
    expect(await listActivities(ctx, DAY)).toHaveLength(2);
  });

  it("validates the whole batch and rejects duplicates within it", async () => {
    const ctx = await createTestUser(db);
    await expect(
      importActivities(ctx, "garmin", [run("ok"), run("bad", { date: "gestern" })]),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(importActivities(ctx, "garmin", [run("dup"), run("dup")])).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(await listActivities(ctx, DAY)).toEqual([]);
  });

  it("steps items never carry kcal; the highest source wins in the summary", async () => {
    const ctx = await createTestUser(db);
    await setDailySteps(ctx, DAY, 5000);
    await importActivities(ctx, "apple_health", [
      { externalId: "s-1", date: DAY, type: "steps", name: "Schritte", steps: 7200, caloriesBurned: 300 },
    ]);
    const s = await getActivitySummary(ctx, DAY);
    expect(s.steps).toBe(7200);
    expect(s.activeKcal).toBe(0);
  });

  it("imports only for the calling user", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    await importActivities(alice, "fitbit", [run("f-1")]);
    expect(await listActivities(bob, DAY)).toEqual([]);
  });
});

describe("swappable providers", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("a registered adapter is synced through the same import path", async () => {
    restore = registerActivityProvider("garmin", () => ({
      id: "garmin",
      displayName: "Garmin (Test)",
      isAvailable: async () => ({ available: true }),
      fetchActivities: async () => [run("garmin-42")],
      fetchDailySteps: async () => [{ date: DAY, steps: 11000 }],
    }));
    const ctx = await createTestUser(db);
    expect(await syncActivityProvider(ctx, "garmin", { from: DAY, to: DAY })).toEqual({
      inserted: 2,
      updated: 0,
    });
    expect(await syncActivityProvider(ctx, "garmin", { from: DAY, to: DAY })).toEqual({
      inserted: 0,
      updated: 2,
    });
    const s = await getActivitySummary(ctx, DAY);
    expect(s).toMatchObject({ steps: 11000, activeKcal: 320, minutes: 30 });
  });
});
