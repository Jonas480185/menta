"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import type { ReactNode } from "react";

export const THEMES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];

/** localStorage key – keep stable, users' choice lives here. */
export const THEME_STORAGE_KEY = "theme";

/**
 * App-wide theme + motion context.
 * - next-themes sets `class="dark"` on <html> before paint (inline script → no flash).
 * - System preference is the default.
 * - Transitions are suppressed while switching so colors don't animate.
 * - MotionConfig makes every `motion` animation honor prefers-reduced-motion.
 */
export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme={false /* color-scheme is set by globals.css per theme */}
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
      themes={["light", "dark"]}
      nonce={nonce}
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}

/** Typed wrapper around next-themes' useTheme. `resolvedTheme` is undefined until mounted. */
export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  return {
    theme: (theme ?? "system") as ThemePreference,
    resolvedTheme: resolvedTheme as "light" | "dark" | undefined,
    setTheme: (next: ThemePreference) => setTheme(next),
  };
}
