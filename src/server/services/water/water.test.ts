import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createTestUser } from "@/test/db";
import type { Db } from "@/server/db/create";
import { addWater, deleteWater, getWaterSummary, setWaterGoal } from "./index";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

const DAY = "2026-09-20";

describe("water", () => {
  it("empty day: 0 ml and the profile goal", async () => {
    const ctx = await createTestUser(db);
    expect(await getWaterSummary(ctx, DAY)).toEqual({ date: DAY, totalMl: 0, goalMl: 2500, entries: [] });
  });

  it("adds, sums per day and deletes", async () => {
    const ctx = await createTestUser(db, { waterGoalMl: 2000 });
    const a = await addWater(ctx, DAY, 250);
    await addWater(ctx, DAY, 500);
    await addWater(ctx, "2026-09-21", 330);
    const s = await getWaterSummary(ctx, DAY);
    expect(s).toMatchObject({ totalMl: 750, goalMl: 2000 });
    expect(s.entries).toHaveLength(2);

    const deleted = await deleteWater(ctx, a.id);
    expect(deleted).toMatchObject({ id: a.id, amountMl: 250, date: DAY });
    expect((await getWaterSummary(ctx, DAY)).totalMl).toBe(500);
    await expect(deleteWater(ctx, a.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("restores an entry with its original timestamp (undo)", async () => {
    const ctx = await createTestUser(db);
    const loggedAt = new Date("2026-09-20T08:15:00Z");
    const entry = await addWater(ctx, DAY, 330, { loggedAt });
    expect(entry.loggedAt).toBe(loggedAt.toISOString());
  });

  it("validates amounts and dates", async () => {
    const ctx = await createTestUser(db);
    await expect(addWater(ctx, DAY, 0)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addWater(ctx, DAY, 5001)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addWater(ctx, DAY, 12.5)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addWater(ctx, "20.09.2026", 250)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(deleteWater(ctx, "not-a-uuid")).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("sets the water goal", async () => {
    const ctx = await createTestUser(db);
    expect(await setWaterGoal(ctx, 3000)).toBe(3000);
    expect((await getWaterSummary(ctx, DAY)).goalMl).toBe(3000);
    await expect(setWaterGoal(ctx, 20000)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("is isolated per user", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    const entry = await addWater(alice, DAY, 250);
    expect((await getWaterSummary(bob, DAY)).totalMl).toBe(0);
    await expect(deleteWater(bob, entry.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getWaterSummary(alice, DAY)).totalMl).toBe(250);
  });
});
