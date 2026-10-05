import { describe, expect, it } from "vitest";
import {
  MACRO_KCAL_TOLERANCE,
  checkConsistency,
  fitMacrosToKcal,
  kcalFromGrams,
  macroEnergyBreakdown,
  macrosFromGrams,
  macrosFromPercent,
  normalizePercents,
  percentFromGrams,
} from "./math";
import { MACRO_PRESETS } from "./presets";
import { MacroInputError } from "./types";

/** Deterministic PRNG (mulberry32) so property tests are reproducible. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isInt = (n: number) => Number.isInteger(n);

describe("kcalFromGrams / macroEnergyBreakdown", () => {
  it("uses 4/4/9", () => {
    expect(kcalFromGrams({ proteinG: 150, carbsG: 200, fatG: 70 })).toBe(600 + 800 + 630);
    expect(kcalFromGrams({ proteinG: 0, carbsG: 0, fatG: 0 })).toBe(0);
    expect(macroEnergyBreakdown({ proteinG: 10, carbsG: 20, fatG: 5 })).toEqual({
      proteinKcal: 40,
      carbsKcal: 80,
      fatKcal: 45,
      totalKcal: 165,
    });
  });
});

describe("percentFromGrams", () => {
  it("returns energy shares summing to 100", () => {
    const p = percentFromGrams({ proteinG: 150, carbsG: 200, fatG: 600 / 9 });
    expect(p.protein).toBeCloseTo(30, 6);
    expect(p.carbs).toBeCloseTo(40, 6);
    expect(p.fat).toBeCloseTo(30, 6);
    expect(p.protein + p.carbs + p.fat).toBeCloseTo(100, 9);
  });

  it("returns zeros for zero energy", () => {
    expect(percentFromGrams({ proteinG: 0, carbsG: 0, fatG: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });

  it("rejects negative grams", () => {
    expect(() => percentFromGrams({ proteinG: -1, carbsG: 0, fatG: 0 })).toThrow(MacroInputError);
  });
});

describe("normalizePercents", () => {
  it("accepts 100 ± 0.5 and scales to exactly 100", () => {
    const p = normalizePercents({ protein: 33.3, carbs: 33.3, fat: 33.3 });
    expect(p.protein + p.carbs + p.fat).toBeCloseTo(100, 9);
  });

  it("rejects sums outside the tolerance with a German message", () => {
    expect(() => normalizePercents({ protein: 30, carbs: 40, fat: 29 })).toThrow(/100 %/);
    try {
      normalizePercents({ protein: 30, carbs: 40, fat: 40 });
    } catch (err) {
      expect(err).toBeInstanceOf(MacroInputError);
      expect((err as MacroInputError).code).toBe("percent_sum");
      expect((err as MacroInputError).message).toContain("110");
    }
  });

  it("rejects out-of-range values", () => {
    expect(() => normalizePercents({ protein: -10, carbs: 60, fat: 50 })).toThrow(MacroInputError);
    expect(() => normalizePercents({ protein: Number.NaN, carbs: 50, fat: 50 })).toThrow(MacroInputError);
  });
});

describe("macrosFromPercent", () => {
  it("computes 30/40/30 at 2000 kcal", () => {
    const r = macrosFromPercent(2000, { protein: 30, carbs: 40, fat: 30 });
    expect(r.macros).toEqual({ proteinG: 150, carbsG: 199, fatG: 67 });
    expect(r.macroKcal).toBe(1999);
    expect(r.diffKcal).toBe(-1);
    expect(r.percents.protein + r.percents.carbs + r.percents.fat).toBeCloseTo(100, 9);
  });

  it("round-trips percent → grams → percent within 1 percentage point for every preset", () => {
    for (const preset of MACRO_PRESETS) {
      for (const kcal of [1500, 2000, 2345, 3200]) {
        const r = macrosFromPercent(kcal, preset.percents);
        const back = percentFromGrams(r.macros);
        expect(Math.abs(back.protein - preset.percents.protein)).toBeLessThan(1);
        expect(Math.abs(back.carbs - preset.percents.carbs)).toBeLessThan(1);
        expect(Math.abs(back.fat - preset.percents.fat)).toBeLessThan(1);
      }
    }
  });

  it("gives 0 g carbs for a 0 % carb split (fat balances)", () => {
    const r = macrosFromPercent(2000, { protein: 30, carbs: 0, fat: 70 });
    expect(r.macros.carbsG).toBe(0);
    expect(Math.abs(r.diffKcal)).toBeLessThanOrEqual(MACRO_KCAL_TOLERANCE);
  });

  it("handles 100 % of one macro", () => {
    expect(macrosFromPercent(2000, { protein: 0, carbs: 100, fat: 0 }).macros).toEqual({
      proteinG: 0,
      carbsG: 500,
      fatG: 0,
    });
    expect(macrosFromPercent(1800, { protein: 0, carbs: 0, fat: 100 }).macros).toEqual({
      proteinG: 0,
      carbsG: 0,
      fatG: 200,
    });
    expect(macrosFromPercent(2000, { protein: 100, carbs: 0, fat: 0 }).macros).toEqual({
      proteinG: 500,
      carbsG: 0,
      fatG: 0,
    });
  });

  it("rejects invalid kcal", () => {
    expect(() => macrosFromPercent(0, { protein: 30, carbs: 40, fat: 30 })).toThrow(MacroInputError);
    expect(() => macrosFromPercent(-5, { protein: 30, carbs: 40, fat: 30 })).toThrow(MacroInputError);
    expect(() => macrosFromPercent(Number.POSITIVE_INFINITY, { protein: 30, carbs: 40, fat: 30 })).toThrow(
      MacroInputError,
    );
  });
});

describe("macrosFromGrams", () => {
  it("computes carbs as the remainder (180 P / 70 F at 2400 kcal)", () => {
    const r = macrosFromGrams(2400, { proteinG: 180, fatG: 70 });
    expect(r.carbsRemainderG).toBeCloseTo(262.5, 9);
    expect(r.macros).toEqual({ proteinG: 180, carbsG: 263, fatG: 70 });
    expect(r.macroKcal).toBe(2402);
    expect(r.warnings.map((w) => w.code)).not.toContain("carbs_negative");
  });

  it("never changes the user's protein/fat (only rounds to whole grams)", () => {
    const r = macrosFromGrams(2000, { proteinG: 160.4, fatG: 59.6 });
    expect(r.macros.proteinG).toBe(160);
    expect(r.macros.fatG).toBe(60);
  });

  it("flags negative carbs, clamps them to 0 and reports the overshoot", () => {
    const r = macrosFromGrams(1500, { proteinG: 250, fatG: 80 });
    expect(r.carbsRemainderG).toBeLessThan(0);
    expect(r.macros.carbsG).toBe(0);
    expect(r.macroKcal).toBe(1000 + 720);
    expect(r.diffKcal).toBe(220);
    const w = r.warnings.find((x) => x.code === "carbs_negative");
    expect(w?.message).toContain("1.720 kcal");
    expect(w?.message).toContain("220 kcal");
  });

  it("allows exactly zero carbs", () => {
    const r = macrosFromGrams(1000, { proteinG: 70, fatG: 80 });
    expect(r.carbsRemainderG).toBeCloseTo(0, 9);
    expect(r.warnings.map((w) => w.code)).not.toContain("carbs_negative");
  });

  it("rejects negative grams", () => {
    expect(() => macrosFromGrams(2000, { proteinG: -1, fatG: 50 })).toThrow(MacroInputError);
  });
});

describe("fitMacrosToKcal: rounding strategy property test", () => {
  it("keeps 4P + 4C + 9F within ±5 kcal and all grams integer ≥ 0 over 5000 random percent inputs", () => {
    const rand = rng(42);
    for (let i = 0; i < 5000; i++) {
      const kcal = Math.round(800 + rand() * 4200);
      const a = rand();
      const b = rand() * (1 - a);
      const shares = [a, b, 1 - a - b].map((x) => x * 100);
      // shuffle which macro gets which share
      const order = [0, 1, 2].sort(() => rand() - 0.5);
      const percents = { protein: shares[order[0]], carbs: shares[order[1]], fat: shares[order[2]] };
      const r = macrosFromPercent(kcal, percents);
      const { proteinG, carbsG, fatG } = r.macros;
      expect(isInt(proteinG) && isInt(carbsG) && isInt(fatG)).toBe(true);
      expect(Math.min(proteinG, carbsG, fatG)).toBeGreaterThanOrEqual(0);
      expect(Math.abs(r.diffKcal)).toBeLessThanOrEqual(MACRO_KCAL_TOLERANCE);
      // grams stay close to the exact values (protein/fat ±0.5 g unless the fallback kicked in)
      expect(Math.abs(proteinG - (kcal * r.percents.protein) / 400)).toBeLessThan(3);
    }
  });

  it("keeps ±5 kcal for random exact grams that match the target", () => {
    const rand = rng(7);
    for (let i = 0; i < 5000; i++) {
      const kcal = 1000 + rand() * 3000;
      const proteinG = (rand() * kcal * 0.5) / 4;
      const fatG = (rand() * (kcal - proteinG * 4)) / 9;
      const carbsG = (kcal - proteinG * 4 - fatG * 9) / 4;
      const fitted = fitMacrosToKcal(kcal, { proteinG, carbsG, fatG });
      expect(Math.abs(kcalFromGrams(fitted) - kcal)).toBeLessThanOrEqual(MACRO_KCAL_TOLERANCE);
      expect(Math.abs(fitted.proteinG - proteinG)).toBeLessThanOrEqual(0.5);
    }
  });

  it("carbs balance within ±2 kcal when carbs are present", () => {
    const rand = rng(99);
    for (let i = 0; i < 2000; i++) {
      const kcal = Math.round(1200 + rand() * 2800);
      const protein = 25 + rand() * 10;
      const r = macrosFromPercent(kcal, { protein, carbs: 40, fat: 60 - protein });
      if (r.macros.carbsG > 0) expect(Math.abs(r.diffKcal)).toBeLessThanOrEqual(2);
    }
  });

  it("falls back to protein when protein alone exceeds the target", () => {
    const fitted = fitMacrosToKcal(400, { proteinG: 120, carbsG: 0, fatG: 0 });
    expect(fitted).toEqual({ proteinG: 100, carbsG: 0, fatG: 0 });
  });
});

describe("checkConsistency", () => {
  it("reports diff and tolerance", () => {
    const c = checkConsistency(2000, { proteinG: 150, carbsG: 200, fatG: 67 });
    expect(c.macroKcal).toBe(2003);
    expect(c.diffKcal).toBe(3);
    expect(c.diffPct).toBeCloseTo(0.15, 6);
    expect(c.withinTolerance).toBe(true);
  });

  it("detects mismatches", () => {
    const c = checkConsistency(2000, { proteinG: 150, carbsG: 250, fatG: 67 });
    expect(c.diffKcal).toBe(203);
    expect(c.withinTolerance).toBe(false);
    expect(checkConsistency(2000, { proteinG: 150, carbsG: 250, fatG: 67 }, 250).withinTolerance).toBe(true);
  });
});

describe("warnings", () => {
  it("flags low calories and very low carbs (keto)", () => {
    const r = macrosFromPercent(1100, { protein: 25, carbs: 5, fat: 70 });
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain("calories_low");
    expect(codes).toContain("carbs_very_low");
  });

  it("flags low fat", () => {
    const r = macrosFromPercent(2000, { protein: 30, carbs: 60, fat: 10 });
    expect(r.warnings.map((w) => w.code)).toContain("fat_low");
  });

  it("has no warnings for a balanced split", () => {
    expect(macrosFromPercent(2200, { protein: 30, carbs: 40, fat: 30 }).warnings).toEqual([]);
  });
});
