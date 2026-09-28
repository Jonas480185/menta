import { describe, expect, it } from "vitest";
import {
  AddActivitySchema,
  AddWaterSchema,
  DEFAULT_WEIGHT_KG,
  MET_ACTIVITIES,
  estimateActivityKcal,
  estimateStepsKcal,
  getMetActivity,
  goalProgress,
  searchMetActivities,
  summarizeActivities,
  type ActivityLike,
} from "./index";

describe("MET table", () => {
  it("has unique keys, plausible MET values and a Compendium reference", () => {
    const keys = new Set(MET_ACTIVITIES.map((a) => a.key));
    expect(keys.size).toBe(MET_ACTIVITIES.length);
    for (const a of MET_ACTIVITIES) {
      expect(a.met).toBeGreaterThan(1);
      expect(a.met).toBeLessThan(20);
      expect(a.compendium).toMatch(/^\d{5} /);
      expect(a.name.length).toBeGreaterThan(0);
    }
  });

  it.each([
    "Gehen",
    "Zügiges Gehen",
    "Laufen (8 km/h)",
    "Laufen (10 km/h)",
    "Laufen (12 km/h)",
    "Radfahren (gemütlich)",
    "Radfahren (zügig)",
    "Schwimmen",
    "Krafttraining (moderat)",
    "Krafttraining (intensiv)",
    "HIIT",
    "Yoga",
    "Pilates",
    "Wandern",
    "Fußball",
    "Tennis",
    "Tanzen",
    "Rudern",
    "Crosstrainer",
  ])("contains %s", (name) => {
    expect(MET_ACTIVITIES.some((a) => a.name === name)).toBe(true);
  });

  it("running gets more intense with speed", () => {
    const m = (k: string) => getMetActivity(k)!.met;
    expect(m("running_8")).toBeLessThan(m("running_10"));
    expect(m("running_10")).toBeLessThan(m("running_12"));
  });

  it("getMetActivity returns undefined for unknown/empty keys", () => {
    expect(getMetActivity("nope")).toBeUndefined();
    expect(getMetActivity(null)).toBeUndefined();
  });
});

describe("searchMetActivities", () => {
  it("returns everything for an empty query", () => {
    expect(searchMetActivities("  ")).toHaveLength(MET_ACTIVITIES.length);
  });

  it("is accent- and ß-insensitive", () => {
    expect(searchMetActivities("fussball")[0].key).toBe("soccer");
    expect(searchMetActivities("zugig").map((a) => a.key)).toContain("walking_brisk");
  });

  it("ranks name prefix matches before keyword matches", () => {
    const keys = searchMetActivities("lauf").map((a) => a.key);
    expect(keys.slice(0, 3)).toEqual(["running_8", "running_10", "running_12"]);
    expect(keys).toContain("walking"); // keyword "laufen"
  });

  it("finds by keyword", () => {
    expect(searchMetActivities("gym").map((a) => a.key)).toEqual(["strength_moderate", "strength_vigorous"]);
  });

  it("returns [] when nothing matches", () => {
    expect(searchMetActivities("quidditch")).toEqual([]);
  });
});

describe("estimateActivityKcal (net)", () => {
  it.each([
    // (9.8 − 1) × 70 × 0.5
    [{ met: 9.8, weightKg: 70, durationMin: 30 }, 308],
    // (3.5 − 1) × 80 × 1
    [{ met: 3.5, weightKg: 80, durationMin: 60 }, 200],
    // (8 − 1) × 60 × 0.75
    [{ met: 8, weightKg: 60, durationMin: 45 }, 315],
  ])("%o → %d kcal", (input, expected) => {
    expect(estimateActivityKcal(input)).toBeCloseTo(expected, 6);
  });

  it("returns 0 for MET ≤ 1 and invalid inputs", () => {
    expect(estimateActivityKcal({ met: 1, weightKg: 70, durationMin: 60 })).toBe(0);
    expect(estimateActivityKcal({ met: 0.5, weightKg: 70, durationMin: 60 })).toBe(0);
    expect(estimateActivityKcal({ met: 5, weightKg: -70, durationMin: 60 })).toBe(0);
    expect(estimateActivityKcal({ met: 5, weightKg: 70, durationMin: Number.NaN })).toBe(0);
  });

  it("is lower than the gross MET value (avoids double counting rest)", () => {
    const gross = 9.8 * 70 * 0.5;
    expect(estimateActivityKcal({ met: 9.8, weightKg: 70, durationMin: 30 })).toBeLessThan(gross);
  });
});

describe("estimateStepsKcal", () => {
  it("10,000 steps at 70 kg ≈ 292 kcal", () => {
    // 100 min at 3.5 MET: 2.5 × 70 × 100/60
    expect(estimateStepsKcal(10000, 70)).toBeCloseTo(291.67, 1);
  });

  it("scales linearly with weight and steps", () => {
    expect(estimateStepsKcal(5000, 70) * 2).toBeCloseTo(estimateStepsKcal(10000, 70), 6);
    expect(estimateStepsKcal(10000, 35) * 2).toBeCloseTo(estimateStepsKcal(10000, 70), 6);
  });

  it("returns 0 for no/invalid steps", () => {
    expect(estimateStepsKcal(0, 70)).toBe(0);
    expect(estimateStepsKcal(-100, 70)).toBe(0);
    expect(estimateStepsKcal(Number.POSITIVE_INFINITY, DEFAULT_WEIGHT_KG)).toBe(0);
  });
});

describe("summarizeActivities", () => {
  const row = (r: Partial<ActivityLike>): ActivityLike => ({
    type: "cardio",
    source: "manual",
    durationMin: null,
    steps: null,
    caloriesBurned: null,
    ...r,
  });

  it("is all zeros for an empty day", () => {
    expect(summarizeActivities([])).toEqual({ activeKcal: 0, minutes: 0, steps: 0, count: 0 });
  });

  it("sums kcal of all rows and minutes/count of non-steps rows", () => {
    const totals = summarizeActivities([
      row({ durationMin: 30, caloriesBurned: 300 }),
      row({ type: "strength", durationMin: 45, caloriesBurned: 150.5 }),
      row({ type: "steps", steps: 8000, caloriesBurned: null }),
    ]);
    expect(totals).toEqual({ activeKcal: 450.5, minutes: 75, steps: 8000, count: 2 });
  });

  it("takes the highest source for steps instead of adding sources", () => {
    const totals = summarizeActivities([
      row({ type: "steps", source: "manual", steps: 6000 }),
      row({ type: "steps", source: "apple_health", steps: 4000 }),
      row({ type: "steps", source: "apple_health", steps: 3500 }),
      row({ type: "steps", source: "garmin", steps: 7000 }),
    ]);
    expect(totals.steps).toBe(7500);
  });

  it("ignores negative/NaN values", () => {
    const totals = summarizeActivities([row({ durationMin: Number.NaN, caloriesBurned: -5 })]);
    expect(totals).toEqual({ activeKcal: 0, minutes: 0, steps: 0, count: 1 });
  });
});

describe("goalProgress", () => {
  it.each([
    [4000, 8000, 0.5],
    [9000, 8000, 1.125],
    [100, 0, 0],
    [-5, 100, 0],
  ])("%d / %d → %d", (v, g, expected) => {
    expect(goalProgress(v, g)).toBeCloseTo(expected, 6);
  });
});

describe("schemas", () => {
  it("AddActivity: MET activity without kcal is valid", () => {
    const r = AddActivitySchema.safeParse({ date: "2026-09-26", metKey: "yoga", durationMin: 30 });
    expect(r.success).toBe(true);
  });

  it("AddActivity: custom activity needs name and kcal", () => {
    const r = AddActivitySchema.safeParse({ date: "2026-09-26", durationMin: 30 });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["metKey", "caloriesBurned"]));
    expect(
      AddActivitySchema.safeParse({
        date: "2026-09-26",
        name: "Klettern",
        durationMin: 60,
        caloriesBurned: 400,
      }).success,
    ).toBe(true);
  });

  it("AddActivity: rejects unknown MET keys and bad durations", () => {
    expect(AddActivitySchema.safeParse({ date: "2026-09-26", metKey: "x", durationMin: 30 }).success).toBe(
      false,
    );
    expect(AddActivitySchema.safeParse({ date: "2026-09-26", metKey: "yoga", durationMin: 0 }).success).toBe(
      false,
    );
  });

  it("AddWater: integer ml within limits", () => {
    expect(AddWaterSchema.safeParse({ date: "2026-09-26", amountMl: 250 }).success).toBe(true);
    expect(AddWaterSchema.safeParse({ date: "2026-09-26", amountMl: 0 }).success).toBe(false);
    expect(AddWaterSchema.safeParse({ date: "2026-09-26", amountMl: 250.5 }).success).toBe(false);
    expect(AddWaterSchema.safeParse({ date: "26.09.2026", amountMl: 250 }).success).toBe(false);
  });
});
