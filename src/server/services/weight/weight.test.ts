import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createTestUser } from "@/test/db";
import { createTestWeightEntry } from "@/test/factories";
import { addDays, todayInTimezone } from "@/lib/dates";
import type { Db } from "@/server/db/create";
import {
  deleteWeight,
  getLatestWeight,
  getWeightTrend,
  listWeights,
  TREND_WARMUP_DAYS,
  upsertWeight,
} from "./index";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

const today = () => todayInTimezone("Europe/Berlin");
const ago = (days: number) => addDays(today(), -days);

describe("upsertWeight", () => {
  it("creates one entry per day and replaces it on a second save", async () => {
    const ctx = await createTestUser(db);
    const first = await upsertWeight(ctx, { date: ago(1), weightKg: 82.4, note: "  morgens " });
    expect(first.previous).toBeNull();
    expect(first.entry).toMatchObject({ date: ago(1), weightKg: 82.4, note: "morgens", bodyFatPct: null });

    const second = await upsertWeight(ctx, { date: ago(1), weightKg: 82.1, bodyFatPct: 24.5, note: "" });
    expect(second.previous).toMatchObject({ weightKg: 82.4, note: "morgens" });
    expect(second.entry).toMatchObject({ id: first.entry.id, weightKg: 82.1, bodyFatPct: 24.5, note: null });
    expect(await listWeights(ctx)).toHaveLength(1);
  });

  it("rejects future dates and implausible values", async () => {
    const ctx = await createTestUser(db);
    await expect(upsertWeight(ctx, { date: addDays(today(), 1), weightKg: 80 })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { date: ["Das Datum liegt in der Zukunft."] },
    });
    await expect(upsertWeight(ctx, { date: today(), weightKg: 8.34 })).rejects.toThrow();
    await expect(upsertWeight(ctx, { date: "26.09.2026", weightKg: 80 })).rejects.toThrow();
  });

  it("keeps users apart", async () => {
    const a = await createTestUser(db);
    const b = await createTestUser(db);
    await upsertWeight(a, { date: today(), weightKg: 70 });
    await upsertWeight(b, { date: today(), weightKg: 90 });
    expect((await getLatestWeight(a))?.weightKg).toBe(70);
    expect((await getLatestWeight(b))?.weightKg).toBe(90);
  });
});

describe("deleteWeight", () => {
  it("deletes and returns the entry, NOT_FOUND otherwise (also for other users' days)", async () => {
    const ctx = await createTestUser(db);
    const other = await createTestUser(db);
    await upsertWeight(ctx, { date: ago(2), weightKg: 75, note: "x" });
    await expect(deleteWeight(other, ago(2))).rejects.toMatchObject({ code: "NOT_FOUND" });
    const deleted = await deleteWeight(ctx, ago(2));
    expect(deleted).toMatchObject({ date: ago(2), weightKg: 75, note: "x" });
    expect(await listWeights(ctx)).toEqual([]);
    await expect(deleteWeight(ctx, ago(2))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("listWeights / getLatestWeight", () => {
  it("filters by range, sorted ascending", async () => {
    const ctx = await createTestUser(db);
    for (const d of [5, 1, 3]) await createTestWeightEntry(ctx, { date: ago(d), weightKg: 80 - d });
    expect((await listWeights(ctx, { from: ago(4), to: ago(1) })).map((e) => e.date)).toEqual([
      ago(3),
      ago(1),
    ]);
    expect((await getLatestWeight(ctx))?.date).toBe(ago(1));
    await expect(listWeights(ctx, { from: ago(1), to: ago(4) })).rejects.toThrow();
  });

  it("returns null without entries", async () => {
    expect(await getLatestWeight(await createTestUser(db))).toBeNull();
  });
});

describe("getWeightTrend", () => {
  it("is empty but well-formed without entries", async () => {
    const ctx = await createTestUser(db, { startWeightKg: 80, targetWeightKg: 75, goalType: "lose" });
    const t = await getWeightTrend(ctx);
    expect(t).toMatchObject({
      from: today(),
      to: today(),
      current: null,
      trendCurrent: null,
      change7d: null,
      weeklyRate: null,
      goal: null,
      entryCount: 0,
      firstEntryDate: null,
    });
    expect(t.points).toEqual([{ date: today(), weightKg: null, avg7: null, trend: null }]);
  });

  it("returns daily points with trend, changes, rate and goal", async () => {
    const ctx = await createTestUser(db, { startWeightKg: 90, targetWeightKg: 80, goalType: "lose" });
    // 42 days, −0.1 kg/day with alternating ±0.5 kg noise.
    for (let d = 41; d >= 0; d--) {
      const noise = d % 2 === 0 ? 0.5 : -0.5;
      await createTestWeightEntry(ctx, { date: ago(d), weightKg: 88 - (41 - d) * 0.1 + noise });
    }
    const t = await getWeightTrend(ctx, { from: ago(29), to: today() });

    expect(t.points).toHaveLength(30);
    expect(t.points[0].date).toBe(ago(29));
    expect(t.points.every((p) => p.weightKg !== null && p.avg7 !== null && p.trend !== null)).toBe(true);
    expect(t.current).toEqual({ date: today(), weightKg: expect.closeTo(84.4, 6) });
    expect(t.entryCount).toBe(42);
    expect(t.firstEntryDate).toBe(ago(41));

    // Trend is smoother than raw values.
    const trends = t.points.map((p) => p.trend!);
    const diffs = trends.slice(1).map((v, i) => Math.abs(v - trends[i]));
    expect(Math.max(...diffs)).toBeLessThan(0.3);

    expect(t.weeklyRate).not.toBeNull();
    expect(t.weeklyRate!).toBeLessThan(-0.4);
    expect(t.weeklyRate!).toBeGreaterThan(-0.9);
    expect(t.change7d!).toBeLessThan(0);
    expect(t.change30d!).toBeLessThan(t.change7d!);

    expect(t.goal).toMatchObject({ targetKg: 80, startKg: 90, goalType: "lose", direction: "towards" });
    expect(t.goal!.progress.direction).toBe("lose");
    expect(t.goal!.progress.fraction!).toBeGreaterThan(0.4);
    expect(t.goal!.projectedDate! > today()).toBe(true);
  });

  it("uses the warm-up window before `from` for the trend", async () => {
    const ctx = await createTestUser(db);
    await createTestWeightEntry(ctx, { date: ago(TREND_WARMUP_DAYS - 10), weightKg: 100 });
    await createTestWeightEntry(ctx, { date: ago(1), weightKg: 80 });
    const t = await getWeightTrend(ctx, { from: ago(3), to: today() });
    expect(t.points.map((p) => p.weightKg)).toEqual([null, null, 80, null]);
    // Trend is seeded from the 100 kg entry (not reset to 80) and carried to today.
    expect(t.points[0].trend).toBe(100);
    expect(t.points[3].trend).toBeGreaterThan(80);
    expect(t.points[3].trend).toBeLessThan(100);
    expect(t.trendCurrent).toBe(t.points[3].trend);
    expect(t.entryCount).toBe(2);
  });

  it("seeds from the last entry before a long break and counts all entries", async () => {
    const ctx = await createTestUser(db);
    await createTestWeightEntry(ctx, { date: ago(400), weightKg: 70 });
    await createTestWeightEntry(ctx, { date: ago(300), weightKg: 72 });
    const t = await getWeightTrend(ctx, { from: ago(6), to: today() });
    expect(t.current).toEqual({ date: ago(300), weightKg: 72 });
    expect(t.points.every((p) => p.trend !== null && p.weightKg === null)).toBe(true);
    expect(t.entryCount).toBe(2);
  });

  it("defaults `from` to the first entry and leaves future days without trend", async () => {
    const ctx = await createTestUser(db);
    await createTestWeightEntry(ctx, { date: ago(2), weightKg: 70 });
    const all = await getWeightTrend(ctx);
    expect(all.from).toBe(ago(2));
    expect(all.points).toHaveLength(3);
    const future = await getWeightTrend(ctx, { from: ago(1), to: addDays(today(), 2) });
    expect(future.points.at(-1)?.trend).toBeNull();
    expect(future.points.at(-3)?.trend).toBe(70);
  });

  it("maintain goal without target uses the start weight", async () => {
    const ctx = await createTestUser(db, { startWeightKg: 70, goalType: "maintain" });
    await createTestWeightEntry(ctx, { date: today(), weightKg: 70.8 });
    const t = await getWeightTrend(ctx);
    expect(t.goal).toMatchObject({
      targetKg: 70,
      direction: "stable",
      projectedDate: null,
      progress: { direction: "maintain", inBand: true, reached: true, fraction: null },
    });
  });
});
