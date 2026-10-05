/**
 * One entry point for all three macro modes: used by the Goals service and, because it is pure,
 * by client components for live previews ("Diese Makros ergeben 2.298 kcal").
 */
import { macrosFromGrams, macrosFromPercent } from "./math";
import { recommendMacros, type MacroRecommendation, type RecommendMacrosInput } from "./recommend";
import type { MacroCalculation, MacroPercents } from "./types";

export type MacroTargetSpec =
  | { mode: "percent"; kcal: number; percents: MacroPercents }
  | { mode: "grams"; kcal: number; proteinG: number; fatG: number }
  | ({ mode: "auto" } & RecommendMacrosInput);

export type MacroTargetResult =
  | (MacroCalculation & { mode: "percent" })
  | (MacroCalculation & { mode: "grams"; carbsRemainderG: number })
  | (MacroRecommendation & { mode: "auto" });

/**
 *   computeMacroTargets({ mode: "grams", kcal: 2400, proteinG: 180, fatG: 70 })
 *   // → 180 P / 263 C / 70 F = 2402 kcal (carbs = (2400 − 720 − 630) / 4 = 262,5 → 263)
 */
export function computeMacroTargets(spec: MacroTargetSpec): MacroTargetResult {
  switch (spec.mode) {
    case "percent":
      return { ...macrosFromPercent(spec.kcal, spec.percents), mode: "percent" };
    case "grams":
      return {
        ...macrosFromGrams(spec.kcal, { proteinG: spec.proteinG, fatG: spec.fatG }),
        mode: "grams",
      };
    case "auto": {
      const { mode, ...input } = spec;
      void mode;
      return { ...recommendMacros(input), mode: "auto" };
    }
  }
}
