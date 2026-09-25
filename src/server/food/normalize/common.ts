/**
 * Helpers shared by provider normalizers. Pure – no network, no DB.
 */
import type { NormalizedServing } from "@/server/food/types";
import { baseServing } from "@/domain/food/units";
import type { NutrientBasis } from "@/domain/nutrition/types";

/** Lenient number parsing for provider payloads ("12,5", "12.5", 12.5 → 12.5). */
export function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Trims, collapses whitespace, strips control characters and caps the length. */
export function cleanText(value: unknown, maxLength = 200): string | null {
  if (typeof value !== "string") return null;
  const s = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > maxLength ? s.slice(0, maxLength).trim() : s;
}

/** "NUTELLA FERRERO WITH BREADSTICKS" → "Nutella Ferrero With Breadsticks" (only if all caps). */
export function titleCaseIfShouting(value: string): string {
  if (/[a-zäöüß]/.test(value) || !/[A-ZÄÖÜ]{3,}/.test(value)) return value;
  return value.toLowerCase().replace(/(^|[\s\-/(&,.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** OFF country tags → ISO 3166-1 alpha-2 (DACH/EU focus + main markets). */
const COUNTRY_TAGS: Record<string, string> = {
  "en:germany": "DE",
  "en:austria": "AT",
  "en:switzerland": "CH",
  "en:france": "FR",
  "en:belgium": "BE",
  "en:netherlands": "NL",
  "en:luxembourg": "LU",
  "en:italy": "IT",
  "en:spain": "ES",
  "en:portugal": "PT",
  "en:poland": "PL",
  "en:czech-republic": "CZ",
  "en:slovakia": "SK",
  "en:hungary": "HU",
  "en:denmark": "DK",
  "en:sweden": "SE",
  "en:norway": "NO",
  "en:finland": "FI",
  "en:ireland": "IE",
  "en:united-kingdom": "GB",
  "en:greece": "GR",
  "en:romania": "RO",
  "en:bulgaria": "BG",
  "en:croatia": "HR",
  "en:slovenia": "SI",
  "en:lithuania": "LT",
  "en:latvia": "LV",
  "en:estonia": "EE",
  "en:united-states": "US",
  "en:canada": "CA",
};

export function countryCodesFromTags(tags: readonly string[] | null | undefined): string[] | null {
  if (!tags?.length) return null;
  const codes = [...new Set(tags.map((t) => COUNTRY_TAGS[t]).filter((c): c is string => !!c))];
  return codes.length ? codes : null;
}

/**
 * Ensures the 100 g/ml base serving exists, removes duplicates (same unit + grams or same
 * label) and marks exactly one default (the one flagged `isDefault`, else the first matching
 * `preferDefault`, else the base serving).
 */
export function finalizeServings(
  servings: readonly NormalizedServing[],
  basis: NutrientBasis,
  preferDefault?: (s: NormalizedServing) => boolean,
): NormalizedServing[] {
  const base = baseServing(basis);
  const out: NormalizedServing[] = [];
  const seen = new Set<string>();
  for (const s of [...servings, base]) {
    if (!(s.grams > 0) || !Number.isFinite(s.grams)) continue;
    const keyA = `${s.unit}|${round(s.grams, 1)}|${round(s.amount, 2)}`;
    const keyB = s.label.toLowerCase();
    if (seen.has(keyA) || seen.has(keyB)) continue;
    seen.add(keyA);
    seen.add(keyB);
    out.push({ label: s.label, amount: s.amount, unit: s.unit, grams: round(s.grams, 2) });
  }
  let idx = servings.findIndex((s) => s.isDefault);
  let target = idx >= 0 ? servings[idx] : undefined;
  if (!target && preferDefault) target = out.find(preferDefault);
  idx = target ? out.findIndex((s) => s.label.toLowerCase() === target!.label.toLowerCase()) : -1;
  if (idx < 0) idx = out.findIndex((s) => s.unit === base.unit && s.grams === 100);
  if (idx < 0) idx = 0;
  return out.map((s, i) => ({ ...s, isDefault: i === idx }));
}
