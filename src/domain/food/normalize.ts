/**
 * Canonical text normalization for food names/brands – used when WRITING
 * foods.name_normalized / brand_normalized and when normalizing search queries,
 * so both sides always match.
 *
 * "Hähnchenbrust  Filet" → "hahnchenbrust filet"
 * "Crème fraîche"        → "creme fraiche"
 * "Weißbrot"             → "weissbrot"
 */
export function normalizeFoodText(input: string): string {
  return input
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%.,]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
