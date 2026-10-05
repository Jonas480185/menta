import { formatKcal, formatNumber, formatSignedKcal, NBSP } from "@/lib/format";
import type { CalorieCalculation } from "./types";

export type CalorieBreakdownKey = "bmr" | "tdee" | "adjustment" | "target";

export interface CalorieBreakdownLine {
  key: CalorieBreakdownKey;
  /** German label, e.g. "Geschätzter Erhaltungsbedarf". */
  label: string;
  /** Whole kcal shown in the UI. */
  kcal: number;
  /** Formatted value, e.g. "2.798 kcal" or "−500 kcal". */
  value: string;
  /** Short "Was heißt das?" explanation. */
  hint: string;
}

export interface CalorieBreakdown {
  lines: CalorieBreakdownLine[];
  /**
   * One-line summary, e.g.
   * "Geschätzter Erhaltungsbedarf: 2.798 kcal · Gewähltes Defizit: −500 kcal · Tagesziel: 2.300 kcal".
   * The adjustment part is omitted when it is 0.
   */
  summary: string;
}

function adjustmentLabel(calc: CalorieCalculation): string {
  const limited = calc.capApplied || calc.floorApplied;
  if (calc.adjustment < 0) return limited ? "Defizit (begrenzt)" : "Gewähltes Defizit";
  if (calc.adjustment > 0) return "Gewählter Überschuss";
  return "Keine Anpassung";
}

function weeklyHint(calc: CalorieCalculation): string {
  if (calc.adjustment === 0) return "Du isst so viel, wie du verbrauchst. Dein Gewicht bleibt etwa gleich.";
  const kg = formatNumber(Math.abs(calc.weeklyChangeKg), { maxFractionDigits: 2 });
  return calc.adjustment < 0
    ? `Damit verlierst du etwa ${kg}${NBSP}kg pro Woche.`
    : `Damit nimmst du etwa ${kg}${NBSP}kg pro Woche zu.`;
}

/**
 * The transparent calculation chain for onboarding/settings:
 * Grundumsatz → × Aktivität = Erhaltungsbedarf → ± Anpassung = Tagesziel.
 * Values are rounded for display only.
 */
export function describeCalorieCalculation(calc: CalorieCalculation): CalorieBreakdown {
  const bmr = Math.round(calc.bmr);
  const tdee = Math.round(calc.tdee);
  const pal = formatNumber(calc.activityMultiplier, { maxFractionDigits: 3 });
  const lines: CalorieBreakdownLine[] = [
    {
      key: "bmr",
      label: "Grundumsatz",
      kcal: bmr,
      value: formatKcal(bmr),
      hint: "Das verbraucht dein Körper in völliger Ruhe, etwa für Atmung, Herzschlag und Wärme.",
    },
    {
      key: "tdee",
      label: "Geschätzter Erhaltungsbedarf",
      kcal: tdee,
      value: formatKcal(tdee),
      hint: `Grundumsatz × ${pal} für deinen Alltag. Bei dieser Menge bleibt dein Gewicht etwa gleich.`,
    },
    {
      key: "adjustment",
      label: adjustmentLabel(calc),
      kcal: calc.adjustment,
      value: formatSignedKcal(calc.adjustment),
      hint: weeklyHint(calc),
    },
    {
      key: "target",
      label: "Tagesziel",
      kcal: calc.target,
      value: formatKcal(calc.target),
      hint: "Deine Empfehlung pro Tag. Du kannst sie jederzeit selbst anpassen.",
    },
  ];
  const summary = lines
    .filter((l) => l.key !== "bmr" && !(l.key === "adjustment" && l.kcal === 0))
    .map((l) => `${l.label}: ${l.value}`)
    .join(" · ");
  return { lines, summary };
}
