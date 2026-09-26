import { describe, expect, it } from "vitest";
import {
  goalDirection,
  goalProgress,
  MAINTAIN_BAND_KG,
  MAX_PROJECTION_WEEKS,
  projectGoalDate,
  STABLE_RATE_KG_PER_WEEK,
  trendDirectionRelativeToGoal,
} from "./goal";

describe("goalDirection", () => {
  it("derives lose/gain and treats small differences as maintain", () => {
    expect(goalDirection(90, 80)).toBe("lose");
    expect(goalDirection(60, 65)).toBe("gain");
    expect(goalDirection(70, 70 + MAINTAIN_BAND_KG)).toBe("maintain");
  });
});

describe("goalProgress", () => {
  it("measures progress for losing", () => {
    expect(goalProgress({ start: 90, current: 85, target: 80 })).toEqual({
      direction: "lose",
      fraction: 0.5,
      remainingKg: 5,
      reached: false,
      inBand: false,
    });
  });

  it("measures progress for gaining", () => {
    const p = goalProgress({ start: 60, current: 61, target: 64 });
    expect(p.direction).toBe("gain");
    expect(p.fraction).toBeCloseTo(0.25, 10);
    expect(p.remainingKg).toBeCloseTo(3, 10);
  });

  it("clamps to 0 when moving away and to 1 when past the target", () => {
    expect(goalProgress({ start: 90, current: 92, target: 80 }).fraction).toBe(0);
    const past = goalProgress({ start: 90, current: 79, target: 80 });
    expect(past).toMatchObject({ fraction: 1, remainingKg: 0, reached: true });
  });

  it("uses the band for maintain goals", () => {
    expect(goalProgress({ start: 70, current: 71, target: 70, goalType: "maintain" })).toEqual({
      direction: "maintain",
      fraction: null,
      remainingKg: 0,
      reached: true,
      inBand: true,
    });
    const out = goalProgress({ start: 70, current: 73, target: 70, goalType: "maintain" });
    expect(out.reached).toBe(false);
    expect(out.remainingKg).toBeCloseTo(3 - MAINTAIN_BAND_KG, 10);
  });

  it("forces maintain from the goal type even when start and target differ", () => {
    expect(goalProgress({ start: 80, current: 75, target: 70, goalType: "maintain" }).direction).toBe(
      "maintain",
    );
  });
});

describe("trendDirectionRelativeToGoal", () => {
  it("is stable below the threshold or without a rate", () => {
    expect(trendDirectionRelativeToGoal({ weeklyRate: null, current: 85, target: 80 })).toBe("stable");
    expect(
      trendDirectionRelativeToGoal({ weeklyRate: STABLE_RATE_KG_PER_WEEK / 2, current: 85, target: 80 }),
    ).toBe("stable");
  });

  it("compares the sign of the rate with the remaining gap", () => {
    expect(trendDirectionRelativeToGoal({ weeklyRate: -0.5, current: 85, target: 80 })).toBe("towards");
    expect(trendDirectionRelativeToGoal({ weeklyRate: 0.5, current: 85, target: 80 })).toBe("away");
    expect(trendDirectionRelativeToGoal({ weeklyRate: 0.3, current: 60, target: 65 })).toBe("towards");
    expect(trendDirectionRelativeToGoal({ weeklyRate: 0.3, current: 80, target: 80 })).toBe("away");
  });

  it("maintain: moving inside the band is away, back towards the target is towards", () => {
    expect(
      trendDirectionRelativeToGoal({ weeklyRate: 0.3, current: 70.5, target: 70, goalType: "maintain" }),
    ).toBe("away");
    expect(
      trendDirectionRelativeToGoal({ weeklyRate: -0.3, current: 73, target: 70, goalType: "maintain" }),
    ).toBe("towards");
  });
});

describe("projectGoalDate", () => {
  const today = "2026-09-26";

  it("projects linearly at the weekly rate", () => {
    expect(projectGoalDate({ current: 85, target: 80, weeklyRate: -0.5, today })).toBe("2026-12-05"); // 70 days
  });

  it("returns null when flat, heading away, reached or too far out", () => {
    expect(projectGoalDate({ current: 85, target: 80, weeklyRate: null, today })).toBeNull();
    expect(projectGoalDate({ current: 85, target: 80, weeklyRate: -0.05, today })).toBeNull();
    expect(projectGoalDate({ current: 85, target: 80, weeklyRate: 0.5, today })).toBeNull();
    expect(projectGoalDate({ current: 80, target: 80, weeklyRate: -0.5, today })).toBeNull();
    const far = (MAX_PROJECTION_WEEKS + 1) * 0.11;
    expect(projectGoalDate({ current: 80 + far, target: 80, weeklyRate: -0.11, today })).toBeNull();
  });
});
