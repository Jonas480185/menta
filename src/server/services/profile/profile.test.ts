import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import { createTestWeightEntry } from "@/test/factories";
import { addDays, todayInTimezone } from "@/lib/dates";
import type { Db } from "@/server/db/create";
import { userProfiles } from "@/server/db/schema";
import { getCurrentWeight, getCurrentWeightKg, getProfile, updateProfile } from "./index";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

describe("getProfile", () => {
  it("returns the user's own row", async () => {
    const ctx = await createTestUser(db, { heightCm: 172 });
    await createTestUser(db, { heightCm: 190 });
    const row = await getProfile(ctx);
    expect(row.userId).toBe(ctx.userId);
    expect(row.heightCm).toBe(172);
  });

  it("throws NOT_FOUND without profile row", async () => {
    const ctx = await createTestUser(db);
    await db.delete(userProfiles).where(eq(userProfiles.userId, ctx.userId));
    await expect(getProfile(ctx)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("updateProfile", () => {
  it("applies a partial patch and leaves other users alone", async () => {
    const ctx = await createTestUser(db);
    const other = await createTestUser(db, { heightCm: 160 });
    const row = await updateProfile(ctx, {
      sex: "female",
      birthDate: "1995-03-01",
      heightCm: 168.5,
      startWeightKg: 64,
      activityLevel: "active",
      goalType: "lose",
      goalPace: "slow",
      targetWeightKg: 60,
    });
    expect(row).toMatchObject({ sex: "female", heightCm: 168.5, goalType: "lose", goalPace: "slow", targetWeightKg: 60 });
    expect((await getProfile(other)).heightCm).toBe(160);
  });

  it("empty patch returns the current row", async () => {
    const ctx = await createTestUser(db, { heightCm: 181 });
    expect((await updateProfile(ctx, {})).heightCm).toBe(181);
  });

  it("rejects values outside the DB ranges with German field errors", async () => {
    const ctx = await createTestUser(db);
    await expect(updateProfile(ctx, { heightCm: 40, startWeightKg: 500 })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: {
        heightCm: ["Bitte eine Größe zwischen 50 und 300 cm eingeben."],
        startWeightKg: ["Bitte ein Gewicht zwischen 20 und 400 kg eingeben."],
      },
    });
  });

  it("rejects unknown/protected keys like bmrKcal", async () => {
    const ctx = await createTestUser(db);
    await expect(updateProfile(ctx, { bmrKcal: 1 } as never)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("checks the age from the birth date", async () => {
    const ctx = await createTestUser(db);
    const today = todayInTimezone(ctx.timezone);
    await expect(updateProfile(ctx, { birthDate: addDays(today, -365 * 5) })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { birthDate: [expect.stringContaining("zwischen 14 und 120")] },
    });
    await expect(updateProfile(ctx, { birthDate: addDays(today, 1) })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects unknown calculators and invalid time zones", async () => {
    const ctx = await createTestUser(db);
    await expect(updateProfile(ctx, { calculatorId: "nope" })).rejects.toMatchObject({
      fieldErrors: { calculatorId: [expect.any(String)] },
    });
    await expect(updateProfile(ctx, { timezone: "Mars/Olympus" })).rejects.toMatchObject({
      fieldErrors: { timezone: [expect.any(String)] },
    });
    expect((await updateProfile(ctx, { calculatorId: "katch_mcardle" })).calculatorId).toBe("katch_mcardle");
  });

  it("maintain clears the pace", async () => {
    const ctx = await createTestUser(db, { goalType: "lose", goalPace: "fast" });
    const row = await updateProfile(ctx, { goalType: "maintain", goalPace: "slow" });
    expect(row.goalPace).toBeNull();
  });

  it("gain has no fast pace: explicit → error, inherited → moderate", async () => {
    const ctx = await createTestUser(db, { goalType: "lose", goalPace: "fast" });
    await expect(updateProfile(ctx, { goalType: "gain", goalPace: "fast" })).rejects.toMatchObject({
      fieldErrors: { goalPace: [expect.any(String)] },
    });
    const row = await updateProfile(ctx, { goalType: "gain" });
    expect(row).toMatchObject({ goalType: "gain", goalPace: "moderate" });
  });

  it("allows clearing the target weight", async () => {
    const ctx = await createTestUser(db, { targetWeightKg: 70 });
    expect((await updateProfile(ctx, { targetWeightKg: null })).targetWeightKg).toBeNull();
  });
});

describe("getCurrentWeight", () => {
  it("uses the latest entry up to today, ignoring future entries and other users", async () => {
    const ctx = await createTestUser(db, { startWeightKg: 90 });
    const other = await createTestUser(db);
    const today = todayInTimezone(ctx.timezone);
    await createTestWeightEntry(ctx, { date: addDays(today, -10), weightKg: 88, bodyFatPct: 24 });
    await createTestWeightEntry(ctx, { date: addDays(today, -2), weightKg: 86.4 });
    await createTestWeightEntry(ctx, { date: addDays(today, 3), weightKg: 50 });
    await createTestWeightEntry(other, { date: today, weightKg: 120 });

    expect(await getCurrentWeight(ctx)).toEqual({
      weightKg: 86.4,
      source: "entry",
      date: addDays(today, -2),
      bodyFatPct: 24,
    });
    expect(await getCurrentWeightKg(ctx)).toBe(86.4);
  });

  it("falls back to the start weight, then null", async () => {
    const withStart = await createTestUser(db, { startWeightKg: 72 });
    expect(await getCurrentWeight(withStart)).toEqual({ weightKg: 72, source: "start", date: null, bodyFatPct: null });
    const empty = await createTestUser(db);
    expect(await getCurrentWeightKg(empty)).toBeNull();
  });
});
