/**
 * Serving / quantity parsing: pure, framework-free.
 *
 * Turns free-text portion descriptions from providers and users
 * ("30 g", "250 ml", "1 Stück (60 g)", "2 Scheiben = 50g", "1 EL (15 ml)", "½ Packung",
 * "1 bar (40 g)", "3 pieces (30 g)") into a `ServingSpec` with a unit code, a count and
 * the amount in the food's nutrient basis (g or ml). Labels are generated in German.
 */
import type { NutrientBasis } from "@/domain/nutrition/types";
import { normalizeFoodText } from "./normalize";

export const SERVING_UNITS = [
  "g",
  "ml",
  "piece",
  "slice",
  "serving",
  "tbsp",
  "tsp",
  "package",
  "cup",
  "bottle",
  "can",
  "glass",
] as const;
export type ServingUnit = (typeof SERVING_UNITS)[number];

/** Structurally identical to `NormalizedServing` (src/server/food/types.ts). */
export interface ServingSpec {
  label: string;
  amount: number;
  unit: ServingUnit;
  /** Amount in base units of the nutrient basis (g or ml) for the whole serving. */
  grams: number;
  isDefault?: boolean;
}

export interface UnitLabel {
  one: string;
  other: string;
}

/** German display labels per unit code. */
export const SERVING_UNIT_LABELS_DE: Record<ServingUnit, UnitLabel> = {
  g: { one: "g", other: "g" },
  ml: { one: "ml", other: "ml" },
  piece: { one: "Stück", other: "Stück" },
  slice: { one: "Scheibe", other: "Scheiben" },
  serving: { one: "Portion", other: "Portionen" },
  tbsp: { one: "EL", other: "EL" },
  tsp: { one: "TL", other: "TL" },
  package: { one: "Packung", other: "Packungen" },
  cup: { one: "Tasse", other: "Tassen" },
  bottle: { one: "Flasche", other: "Flaschen" },
  can: { one: "Dose", other: "Dosen" },
  glass: { one: "Glas", other: "Gläser" },
};

/** Typical volumes of household measures, used only when no weight/volume is declared. */
export const DEFAULT_UNIT_VOLUME_ML: Partial<Record<ServingUnit, number>> = {
  tbsp: 15,
  tsp: 5,
  cup: 240,
  glass: 200,
};

export function isServingUnit(value: string): value is ServingUnit {
  return (SERVING_UNITS as readonly string[]).includes(value);
}

interface WordInfo {
  unit: ServingUnit;
  /** German label overriding the generic unit label (e.g. "Riegel" instead of "Stück"). */
  label?: UnitLabel;
}

const L = (one: string, other = one): UnitLabel => ({ one, other });

/** Count words (normalized via normalizeFoodText, i.e. lowercase and umlauts folded). */
const COUNT_WORDS: Record<string, WordInfo> = {};
function words(list: string[], info: WordInfo) {
  for (const w of list) COUNT_WORDS[w] = info;
}
words(["stuck", "stk", "st", "piece", "pieces", "pc", "pcs", "each", "ea", "item", "items", "unit", "units"], {
  unit: "piece",
});
words(["riegel", "bar", "bars"], { unit: "piece", label: L("Riegel") });
words(["tafel", "tafeln"], { unit: "piece", label: L("Tafel", "Tafeln") });
words(["kugel", "kugeln", "scoop", "scoops"], { unit: "piece", label: L("Kugel", "Kugeln") });
words(["keks", "kekse", "cookie", "cookies", "biscuit", "biscuits", "cracker", "crackers"], {
  unit: "piece",
  label: L("Keks", "Kekse"),
});
words(["wurfel", "cube", "cubes"], { unit: "piece", label: L("Würfel") });
words(["praline", "pralinen"], { unit: "piece", label: L("Praline", "Pralinen") });
words(["brotchen"], { unit: "piece", label: L("Brötchen") });
words(["ei", "eier", "egg", "eggs"], { unit: "piece", label: L("Ei", "Eier") });
words(["scheibe", "scheiben", "slice", "slices", "sl"], { unit: "slice" });
words(["portion", "portionen", "serving", "servings", "serve", "portions"], { unit: "serving" });
words(["handvoll", "handful", "handfuls"], { unit: "serving", label: L("Handvoll") });
words(["el", "essloffel", "tbsp", "tbs", "tbl", "tablespoon", "tablespoons"], { unit: "tbsp" });
words(["tl", "teeloffel", "tsp", "teaspoon", "teaspoons"], { unit: "tsp" });
words(["packung", "packungen", "pack", "packs", "package", "packages", "packet", "packets", "pkg", "packchen"], {
  unit: "package",
});
words(["becher", "tub", "tubs", "pot", "pots"], { unit: "package", label: L("Becher") });
words(["beutel", "bag", "bags", "tute", "tuten", "sachet", "sachets"], { unit: "package", label: L("Beutel") });
words(["tasse", "tassen", "cup", "cups"], { unit: "cup" });
words(["flasche", "flaschen", "bottle", "bottles"], { unit: "bottle" });
words(["dose", "dosen", "can", "cans", "tin", "tins"], { unit: "can" });
words(["glas", "glaser", "glass", "glasses"], { unit: "glass" });

type MeasureUnit = "g" | "ml";
interface MeasureDef {
  base: MeasureUnit;
  factor: number;
}

/** Weight / volume units (normalized spelling → conversion to g or ml). */
const MEASURE_UNITS: Record<string, MeasureDef> = {
  g: { base: "g", factor: 1 },
  gr: { base: "g", factor: 1 },
  grs: { base: "g", factor: 1 },
  gram: { base: "g", factor: 1 },
  grams: { base: "g", factor: 1 },
  gramm: { base: "g", factor: 1 },
  gramme: { base: "g", factor: 1 },
  grammes: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  mg: { base: "g", factor: 0.001 },
  oz: { base: "g", factor: 28.3495 },
  lb: { base: "g", factor: 453.592 },
  lbs: { base: "g", factor: 453.592 },
  ml: { base: "ml", factor: 1 },
  milliliter: { base: "ml", factor: 1 },
  millilitre: { base: "ml", factor: 1 },
  cl: { base: "ml", factor: 10 },
  dl: { base: "ml", factor: 100 },
  l: { base: "ml", factor: 1000 },
  lt: { base: "ml", factor: 1000 },
  ltr: { base: "ml", factor: 1000 },
  liter: { base: "ml", factor: 1000 },
  litre: { base: "ml", factor: 1000 },
  liters: { base: "ml", factor: 1000 },
  litres: { base: "ml", factor: 1000 },
  floz: { base: "ml", factor: 29.5735 },
};

const FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "¼": "1/4",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅛": "1/8",
  "⅕": "1/5",
};

/** Number pattern: "1", "1,5", "1.5", "1/2", "1 1/2". */
const NUM = String.raw`(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)`;

function prepare(text: string): string {
  let t = text.replace(/℮/g, " "); // ℮ estimated sign
  t = t.replace(/(\d)\s*([½¼¾⅓⅔⅛⅕])/g, (_, d: string, f: string) => `${d} ${FRACTIONS[f]}`);
  t = t.replace(/[½¼¾⅓⅔⅛⅕]/g, (f) => FRACTIONS[f]);
  t = t.replace(/\bfl\.?\s*oz\b/gi, "floz");
  return t;
}

/** Parses "1", "1,5", "1/2", "1 1/2" → number. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

interface Measure {
  value: number;
  base: MeasureUnit;
  index: number;
  /** Declared inside parentheses or after "=": the most explicit kind of weight. */
  explicit: boolean;
  metric: boolean;
}

function findMeasures(t: string): Measure[] {
  const re = new RegExp(String.raw`${NUM}\s*([a-zA-Z]+)\.?(?![a-zA-ZäöüÄÖÜß])`, "g");
  const out: Measure[] = [];
  for (const m of t.matchAll(re)) {
    const unitKey = m[2].toLowerCase();
    const def = MEASURE_UNITS[unitKey];
    if (!def) continue;
    const amount = parseAmount(m[1]);
    if (amount === null) continue;
    const before = t.slice(0, m.index);
    const explicit = /[(=]\s*$/.test(before) || /\([^)]*$/.test(before);
    out.push({
      value: amount * def.factor,
      base: def.base,
      index: m.index ?? 0,
      explicit,
      metric: !["oz", "lb", "lbs", "floz"].includes(unitKey),
    });
  }
  return out;
}

interface Count {
  amount: number;
  info: WordInfo;
}

function findCount(t: string): Count | null {
  const re = new RegExp(String.raw`(?:^|[\s(=,;/])(?:${NUM}\s*)?([A-Za-zÄÖÜäöüß]+)\.?`, "g");
  for (const m of t.matchAll(re)) {
    const word = normalizeFoodText(m[2]);
    const info = COUNT_WORDS[word];
    if (!info) continue;
    const amount = m[1] ? parseAmount(m[1]) : 1;
    if (amount === null || amount <= 0) continue;
    return { amount, info };
  }
  return null;
}

const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** German amount formatting with common fractions: 0.5 → "½", 1.5 → "1½", 2 → "2". */
export function formatAmountDe(amount: number): string {
  const whole = Math.floor(amount);
  const rest = Math.round((amount - whole) * 100) / 100;
  const frac = rest === 0.5 ? "½" : rest === 0.25 ? "¼" : rest === 0.75 ? "¾" : null;
  if (frac) return whole === 0 ? frac : `${whole}${frac}`;
  return numberFormat.format(amount);
}

/** "45" → "45", 6.52 → "6,5" */
export function formatQuantityDe(value: number): string {
  return numberFormat.format(value);
}

export interface FormatServingLabelInput {
  amount: number;
  unit: ServingUnit;
  grams?: number | null;
  basis?: NutrientBasis;
  /** Overrides the generic unit label, e.g. "Riegel". */
  unitLabel?: UnitLabel;
  /** Size/preparation note, e.g. "mittel" → "1 Stück (mittel, 118 g)". */
  note?: string | null;
}

/** "1 Scheibe (45 g)", "2 Scheiben (50 g)", "½ Packung (125 g)", "30 g", "1 Stück (mittel, 180 g)". */
export function formatServingLabel(input: FormatServingLabelInput): string {
  const basis = input.basis ?? "g";
  if (input.unit === "g" || input.unit === "ml") {
    return `${formatQuantityDe(input.amount)} ${input.unit}`;
  }
  const labels = input.unitLabel ?? SERVING_UNIT_LABELS_DE[input.unit];
  const word = input.amount > 1 ? labels.other : labels.one;
  const parts: string[] = [];
  if (input.note) parts.push(input.note);
  if (input.grams && input.grams > 0) parts.push(`${formatQuantityDe(input.grams)} ${basis}`);
  const suffix = parts.length ? ` (${parts.join(", ")})` : "";
  return `${formatAmountDe(input.amount)} ${word}${suffix}`;
}

/** Converts an amount in g or ml into the food's basis unit (density default 1 g/ml). */
export function toBasisUnits(
  value: number,
  from: MeasureUnit,
  basis: NutrientBasis,
  densityGPerMl?: number | null,
): number {
  if (from === basis) return value;
  const density = densityGPerMl && densityGPerMl > 0 ? densityGPerMl : 1;
  return from === "ml" ? value * density : value / density;
}

export interface ParseServingOptions {
  /** Basis of the food's nutrient values; servings are expressed in it. Default "g". */
  basis?: NutrientBasis;
  densityGPerMl?: number | null;
  /** Package content in basis units: resolves "½ Packung" etc. */
  packageSize?: number | null;
  /** Keep this label instead of generating one (e.g. curated data). */
  label?: string;
}

const MAX_SERVING = 10_000;

/**
 * Parses a serving description. Returns null when no amount in g/ml can be derived.
 *
 * parseServing("1 Stück (60 g)")   → { label: "1 Stück (60 g)", amount: 1, unit: "piece", grams: 60 }
 * parseServing("2 Scheiben = 50g") → { label: "2 Scheiben (50 g)", amount: 2, unit: "slice", grams: 50 }
 * parseServing("250 ml", { basis: "ml" }) → { label: "250 ml", amount: 250, unit: "ml", grams: 250 }
 * parseServing("½ Packung", { packageSize: 250 }) → { label: "½ Packung (125 g)", amount: 0.5, unit: "package", grams: 125 }
 */
export function parseServing(text: string, opts: ParseServingOptions = {}): ServingSpec | null {
  if (!text || !text.trim()) return null;
  const basis = opts.basis ?? "g";
  const t = prepare(text);
  const measures = findMeasures(t);
  const count = findCount(t);

  const pick =
    measures.find((m) => m.explicit && m.metric) ??
    measures.find((m) => m.metric) ??
    measures.find((m) => m.explicit) ??
    measures[0];

  let spec: ServingSpec | null = null;
  if (count) {
    let grams: number | null = null;
    if (pick) {
      grams = toBasisUnits(pick.value, pick.base, basis, opts.densityGPerMl);
    } else if (count.info.unit === "package" && opts.packageSize) {
      grams = opts.packageSize * count.amount;
    } else {
      const ml = DEFAULT_UNIT_VOLUME_ML[count.info.unit];
      if (ml && (basis === "ml" || opts.densityGPerMl)) {
        grams = toBasisUnits(ml * count.amount, "ml", basis, opts.densityGPerMl);
      }
    }
    if (grams === null) return null;
    spec = {
      label: formatServingLabel({
        amount: count.amount,
        unit: count.info.unit,
        grams,
        basis,
        unitLabel: count.info.label,
      }),
      amount: count.amount,
      unit: count.info.unit,
      grams,
    };
  } else if (pick) {
    const unit: ServingUnit = pick.base;
    const amount = pick.value;
    spec = {
      label: formatServingLabel({ amount, unit }),
      amount,
      unit,
      grams: toBasisUnits(pick.value, pick.base, basis, opts.densityGPerMl),
    };
  }

  if (!spec || !isValidServingGrams(spec.grams)) return null;
  spec.grams = roundTo(spec.grams, 2);
  spec.amount = roundTo(spec.amount, 3);
  if (opts.label) spec.label = opts.label;
  return spec;
}

export function isValidServingGrams(grams: number): boolean {
  return Number.isFinite(grams) && grams > 0 && grams <= MAX_SERVING;
}

export interface ParsedQuantity {
  /** Total content in g or ml. */
  total: number;
  unit: MeasureUnit;
  /** Number of units in a multipack ("6 x 1,5 l" → 6), else 1. */
  count: number;
  /** Content of a single unit ("6 x 1,5 l" → 1500). */
  unitSize: number;
}

/**
 * Parses package quantities: "500g", "1 l", "70 cl", "0.5 kg", "100 g ℮", "6 x 1,5 l", "4x125g".
 */
export function parseQuantity(text: string | null | undefined): ParsedQuantity | null {
  if (!text) return null;
  const t = prepare(text);
  const multi = new RegExp(String.raw`(\d+)\s*[x×*]\s*${NUM}\s*([a-zA-Z]+)`, "i").exec(t);
  if (multi) {
    const def = MEASURE_UNITS[multi[3].toLowerCase()];
    const size = parseAmount(multi[2]);
    const count = Number(multi[1]);
    if (def && size && count > 0) {
      const unitSize = size * def.factor;
      return { total: unitSize * count, unit: def.base, count, unitSize };
    }
  }
  const measures = findMeasures(t).filter((m) => m.metric);
  const m = measures[0];
  if (!m || !(m.value > 0)) return null;
  return { total: m.value, unit: m.base, count: 1, unitSize: m.value };
}

/** The "100 g" / "100 ml" reference serving every food has. */
export function baseServing(basis: NutrientBasis): ServingSpec {
  return { label: `100 ${basis}`, amount: 100, unit: basis, grams: 100 };
}

function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
