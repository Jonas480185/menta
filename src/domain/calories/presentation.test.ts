import { describe, expect, it } from "vitest";
import { MINUS, NBSP } from "@/lib/format";
import { calculateAge } from "./age";
import { describeCalorieCalculation } from "./breakdown";
import { calculateCalories } from "./calculate";
import { CalorieInputError } from "./errors";
import { checkManualTarget, MANUAL_TARGET_LIMITS } from "./manual";
import { BodyProfileSchema, CalorieInputSchema, GoalSettingsSchema } from "./schemas";
import type { BodyProfile } from "./types";

const jonas: BodyProfile = { ageYears: 33, sex: "male", heightCm: 180, weightKg: 84, activityLevel: "moderate" };
const kcal = (s: string) => `${s}${NBSP}kcal`;

describe("describeCalorieCalculation", () => {
  it("renders the transparent chain for the reference user", () => {
    const { lines, summary } = describeCalorieCalculation(
      calculateCalories(jonas, { type: "lose", pace: "moderate", targetWeightKg: 78 }),
    );
    expect(lines.map((l) => [l.key, l.label, l.value])).toEqual([
      ["bmr", "Grundumsatz", kcal("1.805")],
      ["tdee", "Geschätzter Erhaltungsbedarf", kcal("2.798")],
      ["adjustment", "Gewähltes Defizit", kcal(`${MINUS}500`)],
      ["target", "Tagesziel", kcal("2.300")],
    ]);
    expect(summary).toBe(
      `Geschätzter Erhaltungsbedarf: ${kcal("2.798")} · Gewähltes Defizit: ${kcal(`${MINUS}500`)} · Tagesziel: ${kcal("2.300")}`,
    );
    expect(lines[1].hint).toContain("1,55");
    expect(lines[2].hint).toBe(`Damit verlierst du etwa 0,45${NBSP}kg pro Woche.`);
  });

  it("labels surplus, limited deficit and maintenance", () => {
    const gain = describeCalorieCalculation(calculateCalories(jonas, { type: "gain", pace: "slow" }));
    expect(gain.lines[2]).toMatchObject({ label: "Gewählter Überschuss", value: kcal("+150") });
    expect(gain.lines[2].hint).toContain("zu");

    const capped = describeCalorieCalculation(calculateCalories(jonas, { type: "lose", pace: "fast" }));
    expect(capped.lines[2].label).toBe("Defizit (begrenzt)");

    const maintain = describeCalorieCalculation(calculateCalories(jonas, { type: "maintain" }));
    expect(maintain.lines[2]).toMatchObject({ label: "Keine Anpassung", kcal: 0 });
    expect(maintain.summary).toBe(`Geschätzter Erhaltungsbedarf: ${kcal("2.798")} · Tagesziel: ${kcal("2.800")}`);
  });
});

describe("checkManualTarget", () => {
  const calc = calculateCalories(jonas, { type: "lose", pace: "moderate" }); // target 2300, floor 1810

  it("accepts a manual target above the floor without hints", () => {
    const check = checkManualTarget(calc, 2200);
    expect(check).toMatchObject({ target: 2200, differenceFromCalculated: -100, belowFloor: false, warnings: [] });
    expect(check.weeklyChangeKg).toBeCloseTo(((2200 - 2798) * 7) / 7700, 9);
  });

  it("allows a target below the floor but adds a hint (never silently overwritten)", () => {
    const check = checkManualTarget(calc, 1500.4);
    expect(check.target).toBe(1500);
    expect(check.belowFloor).toBe(true);
    expect(check.floorKcal).toBe(1810);
    expect(check.warnings.map((w) => w.code)).toEqual(["manual_below_floor"]);
    expect(check.warnings[0].message).toContain(kcal("1.810"));
  });

  it.each([MANUAL_TARGET_LIMITS.min - 1, MANUAL_TARGET_LIMITS.max + 1, Number.NaN])("rejects %d", (value) => {
    expect(() => checkManualTarget(calc, value)).toThrow(CalorieInputError);
  });
});

describe("calculateAge", () => {
  it.each([
    ["1993-05-10", "2026-05-09", 32],
    ["1993-05-10", "2026-05-10", 33],
    ["1993-05-10", "2026-12-31", 33],
    ["2000-02-29", "2024-02-29", 24],
    ["2000-02-29", "2025-02-28", 24],
    ["2000-02-29", "2025-03-01", 25],
    ["2026-09-26", "2026-09-26", 0],
  ])("born %s, on %s → %d", (birth, on, age) => {
    expect(calculateAge(birth, on)).toBe(age);
  });

  it("throws for invalid dates or a future birth date", () => {
    expect(() => calculateAge("1993-02-30", "2026-01-01")).toThrow(RangeError);
    expect(() => calculateAge("10.05.1993", "2026-01-01")).toThrow(RangeError);
    expect(() => calculateAge("2027-01-01", "2026-01-01")).toThrow(RangeError);
  });
});

describe("schemas", () => {
  it("accepts a valid preview input", () => {
    const parsed = CalorieInputSchema.parse({
      profile: jonas,
      goal: { type: "lose", pace: "moderate", targetWeightKg: 78 },
      calculatorId: "mifflin_st_jeor",
    });
    expect(parsed.profile.heightCm).toBe(180);
  });

  it("uses German messages matching the DB ranges", () => {
    const res = BodyProfileSchema.safeParse({ ...jonas, heightCm: 40 });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0].message).toBe("Bitte eine Größe zwischen 50 und 300 cm eingeben.");
    const goal = GoalSettingsSchema.safeParse({ type: "lose", targetWeightKg: 500 });
    expect(goal.error?.issues[0].message).toBe("Bitte ein Zielgewicht zwischen 20 und 400 kg eingeben.");
    expect(BodyProfileSchema.safeParse({ ...jonas, activityLevel: "couch" }).error?.issues[0].message).toBe(
      "Bitte wähle aus, wie aktiv du im Alltag bist.",
    );
  });
});
