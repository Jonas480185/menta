import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND, BRAND_ASSETS } from "./brand";

const publicDir = path.resolve(__dirname, "../../public");

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("BRAND", () => {
  it("uses the agreed primary mint and mascot name", () => {
    expect(BRAND.colors.primary).toBe("#1FC98E");
    expect(BRAND.mascotName).toBe("Milo");
  });

  it("only contains valid 6-digit hex colors", () => {
    for (const value of Object.values(BRAND.colors)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("keeps the documented contrast guarantees (WCAG AA)", () => {
    const { primary, primaryDeep, onPrimary, ink, paper } = BRAND.colors;
    expect(contrast(primaryDeep, paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(primaryDeep, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(onPrimary, primary)).toBeGreaterThanOrEqual(7);
    expect(contrast(primary, ink)).toBeGreaterThanOrEqual(7);
    expect(contrast(ink, paper)).toBeGreaterThanOrEqual(7);
  });

  it("fits PWA constraints (short_name ≤ 12 chars)", () => {
    expect(BRAND.shortName.length).toBeLessThanOrEqual(12);
  });
});

describe("BRAND_ASSETS", () => {
  it.each(Object.entries(BRAND_ASSETS))("%s exists in public/", (_key, url) => {
    expect(existsSync(path.join(publicDir, url))).toBe(true);
  });

  it("SVG assets are pure vector with a viewBox and an accessible name", () => {
    for (const url of Object.values(BRAND_ASSETS).filter((u) => u.endsWith(".svg"))) {
      const svg = readFileSync(path.join(publicDir, url), "utf8");
      expect(svg).toMatch(/viewBox="[\d.\s]+"/);
      expect(svg).toContain(`aria-label="${BRAND.name}"`);
      expect(svg).not.toMatch(/<image|<text|data:/);
    }
  });
});
