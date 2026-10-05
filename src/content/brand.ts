/**
 * Brand constants.
 *
 * Use these for non-CSS contexts: metadata, PWA manifest, OG images, e-mails, aria labels.
 * UI components must NOT read colors from here: use the semantic design tokens from
 * `src/app/globals.css`. See docs/brand/identity.md for the rules.
 */

export const BRAND = {
  /** Product name. Always written "Menta" (capital M) in running text. */
  name: "Menta",
  /** Name for tight spaces (home screen label, PWA short_name). */
  shortName: "Menta",
  /** Primary tagline (German UI language). */
  tagline: "Klarheit auf dem Teller.",
  /** English tagline variant. */
  taglineEn: "Clarity on your plate.",
  /** One-sentence product description (German), e.g. for meta description and manifest. */
  description:
    "Kalorien, Makros und Gewichtstrend im Blick. Mit Milo als Coach an deiner Seite.",
  /** English description variant. */
  descriptionEn:
    "Calories, macros and weight trend at a glance. With Milo as your coach.",
  /** BCP 47 locale of the primary UI language. */
  locale: "de-DE",
  /** Name of the mascot / coach character. */
  mascotName: "Milo",
  /**
   * Core brand colors (hex). Brand-level reference values only.
   * - primary: Menta Mint, fills, marks, progress. Not for text on light backgrounds (contrast 2.0:1).
   * - primaryDeep: text-safe mint for light backgrounds (5.0:1 on paper, 5.4:1 on white).
   * - primarySoft: quiet mint tint for large surfaces/highlights on light backgrounds.
   * - onPrimary: content color on mint fills (9.0:1).
   * - ink: brand near-black; dark-mode canvas and primary text on light.
   * - paper: brand off-white; light-mode canvas and primary text on dark.
   */
  colors: {
    primary: "#1FC98E",
    primaryDeep: "#167957",
    primarySoft: "#E0F7EF",
    onPrimary: "#0B0F0E",
    ink: "#0B0F0E",
    paper: "#F6F8F7",
  },
} as const;

export type Brand = typeof BRAND;
export type BrandColor = keyof Brand["colors"];

/** Public URLs of the brand assets in `public/brand/`. */
export const BRAND_ASSETS = {
  /** Color mark (mint + ink eyes). Works on light and dark backgrounds. 48×48 viewBox. */
  mark: "/brand/menta-mark.svg",
  /** Single-color mark (`currentColor`, eyes cut out). Inline it to inherit text color. */
  markMono: "/brand/menta-mark-mono.svg",
  /** Wordmark "menta" in `currentColor`. Inline it to inherit text color. */
  wordmark: "/brand/menta-wordmark.svg",
  /** Horizontal lockup for light backgrounds (ink wordmark). */
  lockupLight: "/brand/menta-lockup-light.svg",
  /** Horizontal lockup for dark backgrounds (paper wordmark). */
  lockupDark: "/brand/menta-lockup-dark.svg",
  /** Horizontal lockup with `currentColor` wordmark (for inline SVG use). */
  lockup: "/brand/menta-lockup.svg",
  /** App icon, rounded square, ink background. */
  appIcon: "/brand/menta-app-icon.svg",
  /** App icon, full-bleed (maskable, safe zone respected). */
  appIconMaskable: "/brand/menta-app-icon-maskable.svg",
  icon192: "/brand/icon-192.png",
  icon512: "/brand/icon-512.png",
  iconMaskable512: "/brand/icon-maskable-512.png",
  favicon: "/brand/favicon.ico",
} as const;

export type BrandAsset = keyof typeof BRAND_ASSETS;

/** Intrinsic aspect ratios (width / height) of the SVG assets, for sizing <img> without layout shift. */
export const BRAND_ASSET_RATIOS = {
  mark: 1,
  wordmark: 137.1 / 31.4,
  lockup: 199.1 / 48,
} as const;
