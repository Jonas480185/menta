import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND } from "@/content/brand";
import { contrastRatio, loadThemeTokens } from "./color-contrast";
import { NUTRIENT_KEYS, chartColors, nutrientColors, themeColor } from "./tokens";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
const tokens = loadThemeTokens(css);

const themes = [
  ["light", tokens.light],
  ["dark", tokens.dark],
] as const;

/** Foreground / background pairs that carry text → WCAG AA 4.5:1. */
const TEXT_PAIRS: Array<[fg: string, bg: string]> = [
  ["--foreground", "--background"],
  ["--foreground", "--surface-inset"],
  ["--foreground", "--surface-1"],
  ["--foreground", "--surface-2"],
  ["--foreground", "--surface-3"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--primary-foreground", "--primary"],
  ["--brand-foreground", "--brand"],
  ["--primary-strong", "--background"],
  ["--primary-strong", "--card"],
  ["--primary-strong", "--primary-soft"],
  ["--foreground", "--primary-soft"],
  ["--secondary-foreground", "--secondary"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--muted-foreground", "--muted"],
  ["--muted-foreground", "--surface-2"],
  ["--muted-foreground", "--surface-3"],
  ["--muted-foreground", "--surface-inset"],
  ["--accent-foreground", "--accent"],
  ["--destructive-foreground", "--destructive"],
  ["--destructive", "--card"],
  ["--destructive", "--background"],
  ["--destructive", "--destructive-soft"],
  ["--success-foreground", "--success"],
  ["--success", "--card"],
  ["--success", "--success-soft"],
  ["--warning-foreground", "--warning"],
  ["--warning", "--card"],
  ["--warning", "--warning-soft"],
  ["--info-foreground", "--info"],
  ["--info", "--card"],
  ["--info", "--info-soft"],
  ["--chart-axis", "--card"],
  ["--foreground", "--selection"],
  ...NUTRIENT_KEYS.flatMap((k): Array<[string, string]> => [
    [`--${k}-strong`, "--card"],
    [`--${k}-strong`, "--background"],
    [`--${k}-strong`, `--${k}-soft`],
    ["--foreground", `--${k}-soft`],
  ]),
];

/** Non-text UI graphics (focus indicator, data fills) → WCAG 1.4.11 3:1. */
const GRAPHIC_PAIRS: Array<[fg: string, bg: string]> = [
  ["--ring", "--background"],
  ["--ring", "--card"],
  ["--kcal", "--card"],
  ["--protein", "--card"],
  ["--fat", "--card"],
  ["--weight", "--card"],
  ["--activity", "--card"],
  ["--over", "--card"],
];

/**
 * Documented exception (docs/design/design-system.md → "Data colors"):
 * light carbs/fiber/water fills are too light for 3:1 without turning brown/olive.
 * They are never the sole carrier of information (value label + track always shown),
 * so we only guard against them drifting even lighter.
 */
const LIGHT_FILL_EXCEPTIONS = ["--carbs", "--fiber", "--water"];

/** Skeleton contract (foundation) – must never disappear. */
const CONTRACT = [
  "--radius",
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--success",
  "--warning",
  "--border",
  "--input",
  "--ring",
  "--kcal",
  "--protein",
  "--carbs",
  "--fat",
  "--fiber",
  "--water",
  "--weight",
  "--activity",
  "--over",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
];

describe("design tokens · contract", () => {
  it.each(CONTRACT)("%s is defined for light and dark", (name) => {
    expect(() => tokens.light(name)).not.toThrow();
    expect(() => tokens.dark(name)).not.toThrow();
  });

  it.each(CONTRACT.filter((n) => n !== "--radius"))(
    "%s is exposed to Tailwind as --color-*",
    (name) => {
      expect(css).toContain(`--color-${name.slice(2)}: var(${name});`);
    },
  );

  it("every nutrient has fill, soft and strong shades in both themes", () => {
    for (const k of NUTRIENT_KEYS) {
      for (const suffix of ["", "-soft", "-strong"]) {
        const name = `--${k}${suffix}`;
        expect(tokens.light(name), name).toMatch(/^#/);
        expect(tokens.dark(name), name).toMatch(/^#/);
        expect(css).toContain(`--color-${k}${suffix}: var(${name});`);
      }
    }
  });

  it("TS token mirrors only reference existing CSS variables", () => {
    const refs = [...Object.values(nutrientColors), ...Object.values(chartColors)].flatMap((c) =>
      Object.values(c),
    );
    for (const ref of refs) {
      const name = /^var\((--[\w-]+)\)$/.exec(ref)?.[1];
      expect(name, ref).toBeDefined();
      expect(() => tokens.light(name!)).not.toThrow();
    }
  });
});

describe.each(themes)("design tokens · %s contrast", (_theme, get) => {
  it.each(TEXT_PAIRS)("text %s on %s ≥ 4.5:1", (fg, bg) => {
    expect(contrastRatio(get(fg), get(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHIC_PAIRS)("graphic %s on %s ≥ 3:1", (fg, bg) => {
    expect(contrastRatio(get(fg), get(bg))).toBeGreaterThanOrEqual(3);
  });
});

describe("design tokens · data-color exceptions", () => {
  it.each(LIGHT_FILL_EXCEPTIONS)("light %s fill stays ≥ 2:1 on card", (name) => {
    expect(contrastRatio(tokens.light(name), tokens.light("--card"))).toBeGreaterThanOrEqual(2);
  });

  it.each(LIGHT_FILL_EXCEPTIONS)("dark %s fill reaches ≥ 3:1 on card", (name) => {
    expect(contrastRatio(tokens.dark(name), tokens.dark("--card"))).toBeGreaterThanOrEqual(3);
  });
});

describe("design tokens · brand (docs/brand/identity.md)", () => {
  it("light primary is Menta Mint with ink text; text-safe mint is Mint Deep", () => {
    expect(tokens.light("--primary").toLowerCase()).toBe("#1fc98e");
    expect(tokens.light("--primary-foreground").toLowerCase()).toBe("#0b0f0e");
    expect(tokens.light("--primary-strong").toLowerCase()).toBe("#167957");
  });

  it("canvas colors match brand paper / ink and the theme-color meta", () => {
    expect(tokens.light("--background").toLowerCase()).toBe(themeColor.light);
    expect(tokens.dark("--background").toLowerCase()).toBe(themeColor.dark);
    expect(themeColor.light).toBe(BRAND.colors.paper.toLowerCase());
    expect(themeColor.dark).toBe(BRAND.colors.ink.toLowerCase());
    expect(tokens.light("--primary").toLowerCase()).toBe(BRAND.colors.primary.toLowerCase());
  });

  it.each(themes)("%s: --over is a warm hue clearly apart from --destructive", (_t, get) => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
        number,
        number,
        number,
      ];
      const max = Math.max(r, g, b);
      const d = max - Math.min(r, g, b);
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const over = hue(get("--over"));
    const destructive = hue(get("--destructive"));
    expect(over).toBeGreaterThanOrEqual(15); // orange/amber, not red
    expect(over).toBeLessThanOrEqual(45);
    const dist = Math.min(Math.abs(over - destructive), 360 - Math.abs(over - destructive));
    expect(dist).toBeGreaterThanOrEqual(25);
  });
});

describe("contrastRatio", () => {
  it("matches known WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#fff", "#ffffff")).toBe(1);
  });
});

describe("extractBlockVars", () => {
  it("reads selector lists and ignores indented/nested blocks", () => {
    const sample = `:root,\n.light {\n  --a: #fff; /* c */\n}\n@media (x) {\n  :root {\n    --a: #000;\n  }\n}\n.dark {\n  --a: var(--b);\n}`;
    const tokens = loadThemeTokens(sample + "\n:root {\n  --b: #111;\n}");
    expect(tokens.light("--a")).toBe("#fff");
    expect(tokens.dark("--a")).toBe("#111");
  });
});
