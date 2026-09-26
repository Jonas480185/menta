/**
 * Day profiles (Training Day, Rest Day, High/Low Carb, Refeed): derived from the user's default
 * profile. Protein stays constant on every day type; calories are added/removed mainly via carbs,
 * and some kinds additionally shift energy between fat and carbs.
 *
 *   carbsKcal' = carbsKcal + kcalDelta + fatShiftKcal
 *   fatKcal'   = fatKcal − fatShiftKcal            (fat never below 50 % of the base fat)
 *   protein'   = protein
 *
 * Docs: docs/architecture/macro-engine.md §5
 */
import { KCAL_PER_G } from "@/domain/nutrition/types";
import { assertGrams, assertKcal, buildCalculation, fitMacrosToKcal } from "./math";
import { MacroInputError, type DayProfileKind, type MacroCalculation, type Macros } from "./types";

export interface DayProfileKindMeta {
  kind: DayProfileKind;
  /** Short label for chips/segments. */
  label: string;
  /** Name a new profile of this kind gets by default. */
  defaultName: string;
  description: string;
  /** Default calorie change vs. the default profile (kcal). */
  kcalDelta: number;
  /** Energy moved from fat to carbs (kcal, negative = carbs → fat). */
  fatShiftKcal: number;
  /** Whether deriveDayProfile() supports this kind (default can't be derived from itself). */
  derivable: boolean;
}

export const DAY_PROFILE_KINDS: Readonly<Record<DayProfileKind, DayProfileKindMeta>> = {
  default: {
    kind: "default",
    label: "Standard",
    defaultName: "Standard",
    description: "Dein Grundziel. Gilt an allen Tagen ohne eigenes Profil.",
    kcalDelta: 0,
    fatShiftKcal: 0,
    derivable: false,
  },
  training: {
    kind: "training",
    label: "Trainingstag",
    defaultName: "Trainingstag",
    description: "+250 kcal, vor allem aus Kohlenhydraten – Energie für dein Training.",
    kcalDelta: 250,
    fatShiftKcal: 0,
    derivable: true,
  },
  rest: {
    kind: "rest",
    label: "Ruhetag",
    defaultName: "Ruhetag",
    description: "−250 kcal über weniger Kohlenhydrate. Protein bleibt gleich.",
    kcalDelta: -250,
    fatShiftKcal: 0,
    derivable: true,
  },
  high_carb: {
    kind: "high_carb",
    label: "High Carb",
    defaultName: "High-Carb-Tag",
    description: "+200 kcal und mehr Kohlenhydrate statt Fett – ideal für harte Einheiten.",
    kcalDelta: 200,
    fatShiftKcal: 150,
    derivable: true,
  },
  low_carb: {
    kind: "low_carb",
    label: "Low Carb",
    defaultName: "Low-Carb-Tag",
    description: "−200 kcal, deutlich weniger Kohlenhydrate, etwas mehr Fett.",
    kcalDelta: -200,
    fatShiftKcal: -150,
    derivable: true,
  },
  refeed: {
    kind: "refeed",
    label: "Refeed",
    defaultName: "Refeed-Tag",
    description:
      "Geplanter Tag mit mehr Kohlenhydraten (+500 kcal) und wenig Fett – eine Pause von der Diät.",
    kcalDelta: 500,
    fatShiftKcal: 200,
    derivable: true,
  },
  custom: {
    kind: "custom",
    label: "Eigenes",
    defaultName: "Eigenes Profil",
    description: "Startet mit deinen Standardwerten – passe Kalorien und Makros frei an.",
    kcalDelta: 0,
    fatShiftKcal: 0,
    derivable: true,
  },
};

/** Fat is never reduced below this share of the base profile's fat by a fat→carb shift. */
export const MIN_FAT_SHARE_OF_BASE = 0.5;

export type DerivableDayProfileKind = Exclude<DayProfileKind, "default">;

export interface DayProfileBase extends Macros {
  calorieTarget: number;
}

export interface DeriveDayProfileOptions {
  /** Overrides the kind's default kcalDelta. */
  kcalDelta?: number;
  /** Overrides the kind's default fat→carb shift (kcal). */
  fatShiftKcal?: number;
  /** Refeed only: sets the calories to maintenance (TDEE) instead of base + delta. */
  maintenanceKcal?: number | null;
  /** Overrides the German default name. */
  name?: string;
}

export interface DerivedDayProfile {
  kind: DerivableDayProfileKind;
  name: string;
  calorieTarget: number;
  /** Derived profiles store explicit grams (protein & fat fixed, carbs balance). */
  macroMode: "grams";
  calculation: MacroCalculation;
  /** Differences to the base profile – for "+250 kcal · +62 g KH" labels. */
  delta: { kcal: number; proteinG: number; carbsG: number; fatG: number };
}

/**
 * Derives a day profile from the base (default) profile.
 *
 *   deriveDayProfile({ calorieTarget: 2300, proteinG: 150, carbsG: 281, fatG: 64 }, "training")
 *   // → "Trainingstag", 2550 kcal, 150 / 344 / 64 g
 */
export function deriveDayProfile(
  base: DayProfileBase,
  kind: DerivableDayProfileKind,
  opts: DeriveDayProfileOptions = {},
): DerivedDayProfile {
  const meta = DAY_PROFILE_KINDS[kind];
  if (!meta?.derivable) {
    throw new MacroInputError("invalid_kcal", "Dieses Profil kann nicht abgeleitet werden.", "kind");
  }
  assertKcal(base.calorieTarget);
  assertGrams(base);

  const kcalDelta = opts.kcalDelta ?? meta.kcalDelta;
  const shift = opts.fatShiftKcal ?? meta.fatShiftKcal;
  const kcal =
    kind === "refeed" && opts.maintenanceKcal
      ? Math.round(opts.maintenanceKcal)
      : Math.round(base.calorieTarget + kcalDelta);
  assertKcal(kcal);

  const proteinG = base.proteinG;
  const minFat = base.fatG * MIN_FAT_SHARE_OF_BASE;
  const fatG = Math.max(minFat, base.fatG - shift / KCAL_PER_G.fat);
  const carbsG = Math.max(
    0,
    (kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs,
  );

  const macros = fitMacrosToKcal(kcal, { proteinG, carbsG, fatG });
  const calculation = buildCalculation(kcal, macros);
  return {
    kind,
    name: opts.name?.trim() || meta.defaultName,
    calorieTarget: kcal,
    macroMode: "grams",
    calculation,
    delta: {
      kcal: kcal - base.calorieTarget,
      proteinG: macros.proteinG - base.proteinG,
      carbsG: macros.carbsG - base.carbsG,
      fatG: macros.fatG - base.fatG,
    },
  };
}
