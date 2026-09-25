/**
 * WCAG 2.x contrast helpers + a tiny parser for the design tokens in globals.css.
 * Used by the token tests; handy whenever you need to verify a color pair.
 */

export type Rgb = readonly [r: number, g: number, b: number];

export function parseHex(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex color: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as unknown as Rgb;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (WCAG 2.x). */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two hex colors, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type TokenMap = Record<string, string>;

/** Collect custom properties of every top-level (unindented) `selector { … }` block. */
export function extractBlockVars(css: string, selector: string): TokenMap {
  const map: TokenMap = {};
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockRe = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "gm");
  for (const match of css.matchAll(blockRe)) {
    const body = (match[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const decl of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      map[decl[1]!] = decl[2]!.trim().replace(/\s+/g, " ");
    }
  }
  return map;
}

/** Resolve `var(--x)` chains (no fallbacks needed for our tokens). */
export function resolveToken(name: string, ...scopes: TokenMap[]): string {
  const seen = new Set<string>();
  let current = name;
  for (;;) {
    if (seen.has(current)) throw new Error(`Cyclic token: ${name}`);
    seen.add(current);
    const value = scopes.map((s) => s[current]).find((v) => v !== undefined);
    if (value === undefined) throw new Error(`Unknown token: ${current} (from ${name})`);
    const ref = /^var\((--[\w-]+)\)$/.exec(value);
    if (!ref) return value;
    current = ref[1]!;
  }
}

export interface ThemeTokens {
  light: (name: string) => string;
  dark: (name: string) => string;
  root: TokenMap;
  darkBlock: TokenMap;
}

export function loadThemeTokens(css: string): ThemeTokens {
  const root = extractBlockVars(css, ":root");
  const darkBlock = extractBlockVars(css, ".dark");
  return {
    root,
    darkBlock,
    light: (name) => resolveToken(name, root),
    dark: (name) => resolveToken(name, darkBlock, root),
  };
}
