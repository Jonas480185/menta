import { describe, expect, it } from "vitest";
import { DAY_PROFILE_KINDS, deriveDayProfile, type DerivableDayProfileKind } from "./day-profiles";
import { MACRO_KCAL_TOLERANCE } from "./math";
import { MACRO_PRESETS, findMatchingPreset, getMacroPreset } from "./presets";
import { MacroInputError } from "./types";

const base = { calorieTarget: 2300, proteinG: 150, carbsG: 281, fatG: 64 };

describe("deriveDayProfile", () => {
  it("training day: +250 kcal from carbs, protein & fat unchanged", () => {
    const d = deriveDayProfile(base, "training");
    expect(d.name).toBe("Trainingstag");
    expect(d.calorieTarget).toBe(2550);
    expect(d.macroMode).toBe("grams");
    expect(d.calculation.macros).toEqual({ proteinG: 150, carbsG: 344, fatG: 64 });
    expect(d.delta).toEqual({ kcal: 250, proteinG: 0, carbsG: 63, fatG: 0 });
  });

  it("rest day: −250 kcal from carbs", () => {
    const d = deriveDayProfile(base, "rest");
    expect(d.name).toBe("Ruhetag");
    expect(d.calorieTarget).toBe(2050);
    expect(d.calculation.macros.proteinG).toBe(150);
    expect(d.calculation.macros.fatG).toBe(64);
    expect(d.delta.carbsG).toBeLessThan(-60);
  });

  it("high carb: more kcal, carbs up, fat down", () => {
    const d = deriveDayProfile(base, "high_carb");
    expect(d.name).toBe("High-Carb-Tag");
    expect(d.delta.kcal).toBe(200);
    expect(d.delta.carbsG).toBeGreaterThan(80);
    expect(d.delta.fatG).toBeLessThan(0);
  });

  it("low carb: fewer kcal, carbs down, fat up", () => {
    const d = deriveDayProfile(base, "low_carb");
    expect(d.delta.kcal).toBe(-200);
    expect(d.delta.carbsG).toBeLessThan(-80);
    expect(d.delta.fatG).toBeGreaterThan(0);
  });

  it("refeed: carbs way up, fat down; can target maintenance kcal", () => {
    const d = deriveDayProfile(base, "refeed");
    expect(d.name).toBe("Refeed-Tag");
    expect(d.calorieTarget).toBe(2800);
    expect(d.delta.fatG).toBeLessThan(0);
    expect(d.delta.carbsG).toBeGreaterThan(140);
    const m = deriveDayProfile(base, "refeed", { maintenanceKcal: 2798.4 });
    expect(m.calorieTarget).toBe(2798);
  });

  it("never cuts fat below 50 % of the base fat", () => {
    const d = deriveDayProfile(base, "refeed", { fatShiftKcal: 5000 });
    expect(d.calculation.macros.fatG).toBe(32);
  });

  it("honours custom delta and name", () => {
    const d = deriveDayProfile(base, "training", { kcalDelta: 400, name: "  Beintag " });
    expect(d.name).toBe("Beintag");
    expect(d.calorieTarget).toBe(2700);
  });

  it("custom starts as a copy of the base", () => {
    const d = deriveDayProfile(base, "custom");
    expect(d.calorieTarget).toBe(2300);
    expect(d.calculation.macros).toEqual({ proteinG: 150, carbsG: 281, fatG: 64 });
  });

  it("clamps carbs at 0 when a big rest-day cut exceeds them (fat balances)", () => {
    const lowCarb = { calorieTarget: 1800, proteinG: 150, carbsG: 20, fatG: 124 };
    const d = deriveDayProfile(lowCarb, "rest");
    expect(d.calculation.macros.carbsG).toBe(0);
    expect(Math.abs(d.calculation.diffKcal)).toBeLessThanOrEqual(MACRO_KCAL_TOLERANCE);
  });

  it("stays within ±5 kcal for all kinds over many bases", () => {
    const kinds = Object.values(DAY_PROFILE_KINDS)
      .filter((k) => k.derivable)
      .map((k) => k.kind as DerivableDayProfileKind);
    for (const kind of kinds)
      for (let kcal = 1400; kcal <= 4000; kcal += 130)
        for (const pShare of [0.2, 0.3, 0.4])
          for (const fShare of [0.2, 0.3, 0.45]) {
            const b = {
              calorieTarget: kcal,
              proteinG: Math.round((kcal * pShare) / 4),
              fatG: Math.round((kcal * fShare) / 9),
              carbsG: 0,
            };
            b.carbsG = Math.max(0, Math.round((kcal - b.proteinG * 4 - b.fatG * 9) / 4));
            const d = deriveDayProfile(b, kind);
            expect(Math.abs(d.calculation.diffKcal)).toBeLessThanOrEqual(MACRO_KCAL_TOLERANCE);
            expect(d.calculation.macros.proteinG).toBe(b.proteinG);
          }
  });

  it("rejects the default kind and non-positive results", () => {
    expect(() => deriveDayProfile(base, "default" as DerivableDayProfileKind)).toThrow(MacroInputError);
    expect(() => deriveDayProfile(base, "rest", { kcalDelta: -3000 })).toThrow(MacroInputError);
  });
});

describe("DAY_PROFILE_KINDS", () => {
  it("has German names for every kind", () => {
    expect(DAY_PROFILE_KINDS.training.defaultName).toBe("Trainingstag");
    expect(DAY_PROFILE_KINDS.rest.defaultName).toBe("Ruhetag");
    expect(DAY_PROFILE_KINDS.default.derivable).toBe(false);
    for (const meta of Object.values(DAY_PROFILE_KINDS)) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(10);
    }
  });
});

describe("MACRO_PRESETS", () => {
  it("contains the five presets, each summing to 100", () => {
    expect(MACRO_PRESETS.map((p) => p.label)).toEqual([
      "Ausgewogen",
      "Proteinreich",
      "Low Carb",
      "Ausdauer",
      "Keto",
    ]);
    for (const p of MACRO_PRESETS) {
      expect(p.percents.protein + p.percents.carbs + p.percents.fat).toBe(100);
    }
    expect(getMacroPreset("keto").percents).toEqual({ protein: 25, carbs: 5, fat: 70 });
  });

  it("finds a matching preset", () => {
    expect(findMatchingPreset({ protein: 30, carbs: 40, fat: 30 })?.id).toBe("balanced");
    expect(findMatchingPreset({ protein: 31, carbs: 39, fat: 30 })).toBeUndefined();
  });
});
