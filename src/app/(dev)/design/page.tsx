import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NUTRIENT_KEYS } from "@/components/theme/tokens";
import { cn } from "@/lib/utils";
import { MotionDemo } from "./_components/motion-demo";
import { NutritionDemo } from "./_components/nutrition-demo";
import { Swatch } from "./_components/swatch";

export const metadata: Metadata = {
  title: "Design System",
  robots: { index: false, follow: false },
};

const COLOR_GROUPS: Array<{ title: string; tokens: string[] }> = [
  {
    title: "Flächen",
    tokens: [
      "background",
      "surface-inset",
      "surface-1",
      "surface-2",
      "surface-3",
      "card",
      "popover",
      "muted",
      "secondary",
      "accent",
    ],
  },
  { title: "Text", tokens: ["foreground", "muted-foreground", "primary-strong"] },
  {
    title: "Marke & Aktionen",
    tokens: ["brand", "primary", "primary-foreground", "primary-soft", "primary-strong", "ring"],
  },
  {
    title: "Status",
    tokens: [
      "success",
      "success-soft",
      "warning",
      "warning-soft",
      "info",
      "info-soft",
      "destructive",
      "destructive-soft",
    ],
  },
  { title: "Linien", tokens: ["border", "border-strong", "input", "track", "selection"] },
  {
    title: "Ernährung (fill · soft · strong)",
    tokens: NUTRIENT_KEYS.flatMap((k) => [k, `${k}-soft`, `${k}-strong`]),
  },
  {
    title: "Charts",
    tokens: [
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
      "chart-grid",
      "chart-axis",
      "chart-target",
    ],
  },
];

/** Literal class names so Tailwind generates them. */
const TYPE_SCALE = [
  ["text-display numeric", "display · 40→48", "1.620 kcal"],
  ["text-title", "title · 28", "Heute"],
  ["text-heading", "heading · 20", "Mahlzeiten"],
  ["text-headline", "headline · 17", "Haferflocken mit Beeren"],
  ["text-body", "body · 16", "Zahlen sind die Helden, Essen wird nie bewertet."],
  ["text-body-sm", "body-sm · 14", "80 g · 1 Portion · Frühstück"],
  ["text-caption", "caption · 12", "kcal übrig"],
  ["text-overline uppercase text-muted-foreground", "overline · 12", "Makros"],
  ["text-stat numeric", "stat · 32", "83,4 kg"],
  ["text-stat-sm numeric", "stat-sm · 20", "92 / 140 g"],
] as const;

const RADII = [
  ["rounded-xs", "xs · 6"],
  ["rounded-sm", "sm · 10"],
  ["rounded-md", "md / control · 12"],
  ["rounded-lg", "lg · 16"],
  ["rounded-card", "xl / card · 20"],
  ["rounded-2xl", "2xl · 24"],
  ["rounded-sheet", "3xl / sheet · 28"],
  ["rounded-full", "full"],
] as const;

const SHADOWS = ["shadow-xs", "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl"] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="text-heading">{title}</h2>
      {children}
    </section>
  );
}

function ColorPanel({ theme }: { theme: "light" | "dark" }) {
  return (
    <div
      className={cn(
        theme,
        "bg-background text-foreground rounded-card border-border grid gap-6 border p-5",
      )}
    >
      <p className="text-overline text-muted-foreground uppercase">
        {theme === "light" ? "Hell" : "Dunkel"}
      </p>
      {COLOR_GROUPS.map((group) => (
        <div key={group.title} className="grid gap-3">
          <h3 className="text-body-sm font-semibold">{group.title}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {group.tokens.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="px-gutter pt-safe-offset-6 pb-safe-offset-16 mx-auto grid w-full max-w-wide gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-overline text-primary-strong uppercase">Menta · Dev</p>
          <h1 className="text-title">Design System</h1>
          <p className="text-muted-foreground text-body-sm max-w-content">
            Alle Tokens aus <code className="font-mono">src/app/globals.css</code> in Hell und
            Dunkel. Doku: <code className="font-mono">docs/design/design-system.md</code>.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Muster: Ernährung">
        <NutritionDemo />
      </Section>

      <Section title="Farben">
        <div className="grid gap-4 lg:grid-cols-2">
          <ColorPanel theme="light" />
          <ColorPanel theme="dark" />
        </div>
      </Section>

      <Section title="Typografie · Inter">
        <div className="bg-card rounded-card p-card grid gap-5 shadow-sm dark:border">
          {TYPE_SCALE.map(([className, label, sample]) => (
            <div key={label} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-baseline">
              <span className="text-muted-foreground font-mono text-caption">{label}</span>
              <span className={className}>{sample}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Aktionen & Fokus">
        <div className="bg-card rounded-card p-card flex flex-wrap items-center gap-3 shadow-sm dark:border">
          <button
            type="button"
            className="bg-primary text-primary-foreground min-h-11 rounded-md px-5 text-body-sm font-semibold transition-[filter] hover:brightness-95"
          >
            Primär
          </button>
          <button
            type="button"
            className="bg-secondary text-secondary-foreground hover:bg-accent min-h-11 rounded-md px-5 text-body-sm font-medium transition-colors"
          >
            Sekundär
          </button>
          <button
            type="button"
            className="text-primary-strong hover:bg-primary-soft min-h-11 rounded-md px-4 text-body-sm font-medium transition-colors"
          >
            Link-Stil
          </button>
          <button
            type="button"
            className="bg-destructive text-destructive-foreground min-h-11 rounded-md px-5 text-body-sm font-semibold"
          >
            Löschen
          </button>
          <p className="text-muted-foreground text-body-sm w-full">
            Mit Tab durchgehen: 2 px Fokusring in <code className="font-mono">--ring</code>, 2 px
            Abstand. Alle Ziele ≥ 44 px hoch.
          </p>
        </div>
      </Section>

      <Section title="Radien">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {RADII.map(([className, label]) => (
            <div key={label} className="grid gap-2">
              <div className={cn("bg-primary-soft border-primary h-16 border", className)} />
              <span className="text-muted-foreground font-mono text-caption">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Elevation">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
          {SHADOWS.map((shadow, i) => (
            <div
              key={shadow}
              className={cn(
                "bg-card rounded-card flex h-24 items-end p-3 dark:border",
                shadow,
                i >= 2 && "dark:bg-surface-2",
                i >= 4 && "dark:bg-surface-3",
              )}
            >
              <span className="text-muted-foreground font-mono text-caption">{shadow}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Bewegung">
        <MotionDemo />
      </Section>
    </main>
  );
}
