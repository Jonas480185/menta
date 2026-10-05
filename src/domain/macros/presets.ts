/**
 * Percent presets offered in onboarding (step "Makros") and settings. German labels + descriptions.
 * Every preset sums to exactly 100 %.
 */
import type { MacroPercents } from "./types";

export type MacroPresetId = "balanced" | "high_protein" | "low_carb" | "endurance" | "keto";

export interface MacroPreset {
  id: MacroPresetId;
  label: string;
  description: string;
  percents: MacroPercents;
}

export const MACRO_PRESETS: readonly MacroPreset[] = [
  {
    id: "balanced",
    label: "Ausgewogen",
    description: "Die solide Basis für die meisten Ziele, von allem genug.",
    percents: { protein: 30, carbs: 40, fat: 30 },
  },
  {
    id: "high_protein",
    label: "Proteinreich",
    description: "Mehr Protein für Muskelerhalt beim Abnehmen und guten Muskelaufbau. Hält lange satt.",
    percents: { protein: 40, carbs: 30, fat: 30 },
  },
  {
    id: "low_carb",
    label: "Low Carb",
    description: "Weniger Kohlenhydrate, mehr Fett. Für alle, die sich damit wohler fühlen.",
    percents: { protein: 35, carbs: 20, fat: 45 },
  },
  {
    id: "endurance",
    label: "Ausdauer",
    description: "Viele Kohlenhydrate als Treibstoff für Laufen, Radfahren und lange Einheiten.",
    percents: { protein: 20, carbs: 55, fat: 25 },
  },
  {
    id: "keto",
    label: "Keto",
    description:
      "Sehr wenig Kohlenhydrate, viel Fett. Braucht Eingewöhnung und ist nicht ideal für intensives Training.",
    percents: { protein: 25, carbs: 5, fat: 70 },
  },
] as const;

export function getMacroPreset(id: MacroPresetId): MacroPreset {
  const preset = MACRO_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown macro preset: ${id}`);
  return preset;
}

/** The preset whose percents match exactly (± 0.5 per macro), e.g. to highlight it in the UI. */
export function findMatchingPreset(percents: MacroPercents): MacroPreset | undefined {
  return MACRO_PRESETS.find(
    (p) =>
      Math.abs(p.percents.protein - percents.protein) <= 0.5 &&
      Math.abs(p.percents.carbs - percents.carbs) <= 0.5 &&
      Math.abs(p.percents.fat - percents.fat) <= 0.5,
  );
}
