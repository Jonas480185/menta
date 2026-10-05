import { formatLiters, formatMl, formatNumber } from "@/lib/format";

/** Water amounts: ml below 1 l ("750 ml"), litres from 1 l ("1,25 l", two decimals so 250-ml steps stay visible). */
export function formatWaterAmount(ml: number): string {
  return Math.abs(ml) < 1000 ? formatMl(ml) : formatLiters(ml, { maxFractionDigits: 2 });
}

/** "1,25 von 2,5 l getrunken" · "750 ml von 2,5 l getrunken" (brand voice §6.6). */
export function formatWaterProgress(totalMl: number, goalMl: number): string {
  if (goalMl <= 0) return `${formatWaterAmount(totalMl)} getrunken`;
  const current =
    totalMl >= 1000 && goalMl >= 1000
      ? formatNumber(totalMl / 1000, { maxFractionDigits: 2 })
      : formatWaterAmount(totalMl);
  return `${current} von ${formatWaterAmount(goalMl)} getrunken`;
}
