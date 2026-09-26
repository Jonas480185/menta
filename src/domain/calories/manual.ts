import { formatKcal, formatNumber } from "@/lib/format";
import { CalorieInputError } from "./errors";
import { weeklyChangeKgFor } from "./target";
import type { CalorieCalculation, CalorieWarning } from "./types";

/** Hard limits for a manually entered daily target (kcal). Everything inside is allowed. */
export const MANUAL_TARGET_LIMITS = { min: 800, max: 10000 } as const;

export interface ManualTargetCheck {
  /** The manual target, rounded to whole kcal. */
  target: number;
  /** manual − calculated target (kcal). */
  differenceFromCalculated: number;
  /** Expected weekly change vs. the TDEE (kg, negative = loss). */
  weeklyChangeKg: number;
  /** True when the manual target is below the safety floor – allowed, but shown as a hint. */
  belowFloor: boolean;
  floorKcal: number;
  warnings: CalorieWarning[];
}

/**
 * Checks a manual override ("Selbst festlegen"). The user always wins: values inside
 * MANUAL_TARGET_LIMITS are accepted, a value below the safety floor only produces a
 * non-blocking hint (never silently overwritten).
 *
 * Throws CalorieInputError("target") outside MANUAL_TARGET_LIMITS.
 */
export function checkManualTarget(calc: CalorieCalculation, manualKcal: number): ManualTargetCheck {
  const { min, max } = MANUAL_TARGET_LIMITS;
  if (typeof manualKcal !== "number" || !Number.isFinite(manualKcal) || manualKcal < min || manualKcal > max) {
    throw new CalorieInputError(
      "target",
      `Bitte eine Zahl zwischen ${formatNumber(min)} und ${formatNumber(max)} kcal eingeben.`,
    );
  }
  const target = Math.round(manualKcal);
  const belowFloor = target < calc.floorKcal;
  const warnings: CalorieWarning[] = belowFloor
    ? [
        {
          code: "manual_below_floor",
          message: `Dein Ziel liegt unter ${formatKcal(calc.floorKcal)} – weniger empfehlen wir nicht ohne ärztliche Begleitung. Du kannst es trotzdem so speichern.`,
        },
      ]
    : [];
  return {
    target,
    differenceFromCalculated: target - calc.target,
    weeklyChangeKg: weeklyChangeKgFor(target - Math.round(calc.tdee)),
    belowFloor,
    floorKcal: calc.floorKcal,
    warnings,
  };
}
