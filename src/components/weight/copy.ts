import type { GoalProgress, TrendDirection } from "@/domain/weight";
import { formatDateLong, formatNumber, formatWeightKg, NBSP } from "@/lib/format";
import type { IsoDate } from "@/lib/dates";

/**
 * German weight copy (docs/brand/voice-and-tone.md §6.5): neutral, analytical, never judgmental.
 * Trend over single readings; gains and losses are described the same way.
 */

/** Entries needed before the trend line / trend statements are shown. */
export const MIN_ENTRIES_FOR_TREND = 3;

/** |change| below this (kg) is described as "stable". */
const STABLE_CHANGE_KG = 0.2;

export function entriesUntilTrendText(entryCount: number): string {
  const missing = Math.max(0, MIN_ENTRIES_FOR_TREND - entryCount);
  return `Noch ${missing} ${missing === 1 ? "Messung" : "Messungen"} bis zur Trendlinie.`;
}

/** "−0,6 kg": signed, one decimal. */
export function formatWeightDelta(kg: number | null): string {
  return formatWeightKg(kg === null ? null : Math.abs(kg) < 0.05 ? 0 : kg, { signed: true });
}

/** "−0,6 kg in 7 Tagen" · "±0,0 kg in 7 Tagen" is rendered as "0,0 kg …". */
export function changeLabel(kg: number | null, days: number): string {
  return `${formatWeightDelta(kg)} in ${days}${NBSP}Tagen`;
}

/** "0,4 kg/Woche" (absolute). */
export function formatWeeklyRate(kgPerWeek: number): string {
  return `${formatNumber(Math.abs(kgPerWeek), { minFractionDigits: 1, maxFractionDigits: 1 })}${NBSP}kg/Woche`;
}

/** "Dezember 2026". */
export function formatMonthYear(date: IsoDate): string {
  return formatDateLong(date, { weekday: false }).split(" ").slice(1).join(" ");
}

export interface TrendMessageInput {
  entryCount: number;
  change7d: number | null;
  goal: { direction: TrendDirection; progress: GoalProgress } | null;
}

/** One or two neutral sentences about where the trend is heading. */
export function trendMessage({ entryCount, change7d, goal }: TrendMessageInput): string {
  if (entryCount < MIN_ENTRIES_FOR_TREND) return entriesUntilTrendText(entryCount);

  const moved = change7d !== null && Math.abs(change7d) >= STABLE_CHANGE_KG;
  const deltaText = moved
    ? formatNumber(Math.abs(change7d), { minFractionDigits: 1, maxFractionDigits: 1 })
    : "";
  const verb = change7d !== null && change7d < 0 ? "gesunken" : "gestiegen";

  if (goal) {
    const { direction, progress } = goal;
    if (progress.reached && progress.direction !== "maintain") {
      return "Zielgewicht erreicht! Magst du ein neues Ziel setzen oder dein Gewicht halten?";
    }
    if (progress.direction === "maintain" && progress.inBand && direction !== "away") {
      return "Dein Gewicht ist stabil, genau wie geplant.";
    }
    if (direction === "towards") {
      return moved
        ? `Dein Gewichtstrend ist um ${deltaText}${NBSP}kg ${verb}, in Richtung deines Ziels.`
        : "Dein Gewichtstrend bewegt sich in Richtung deines Ziels.";
    }
    if (direction === "away" && moved) {
      return `Dein Gewichtstrend ist um ${deltaText}${NBSP}kg ${verb}. Schwankungen sind normal. Schau dir den Verlauf über 2 bis 3 Wochen an.`;
    }
    return "Dein Gewichtstrend ist stabil.";
  }

  if (!moved) return "Dein Gewichtstrend ist stabil.";
  return `Dein Gewichtstrend ist in den letzten 7 Tagen um ${deltaText}${NBSP}kg ${verb}.`;
}

/** "Ziel 78,0 kg voraussichtlich im März 2027" or a neutral fallback. */
export function projectionText(
  targetKg: number,
  projectedDate: IsoDate | null,
  progress: GoalProgress,
): string {
  const target = formatWeightKg(targetKg);
  if (progress.direction === "maintain") {
    return progress.inBand
      ? `Du bist im Zielbereich um ${target}.`
      : `Noch ${formatWeightKg(progress.remainingKg)} bis zum Zielbereich um ${target}.`;
  }
  if (progress.reached) return `Zielgewicht ${target} erreicht.`;
  if (projectedDate) return `Ziel ${target} voraussichtlich im ${formatMonthYear(projectedDate)}`;
  return `Noch ${formatWeightKg(progress.remainingKg)} bis zu deinem Zielgewicht.`;
}
