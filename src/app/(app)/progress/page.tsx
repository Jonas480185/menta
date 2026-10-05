import type { Metadata } from "next";
import Link from "next/link";
import { CaloriesChart, ProteinChart, type DayPoint } from "@/components/analytics/nutrition-charts";
import { RangeSwitch } from "@/components/analytics/range-switch";
import { StatTile } from "@/components/ui/stat-tile";
import { WeightTrendChart } from "@/components/weight/weight-trend-chart";
import { addDays, dateRange, todayInTimezone } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { getServiceContext } from "@/server/auth/context";
import { getDailyTotals } from "@/server/services/nutrition";
import { getWeightTrend } from "@/server/services/weight";
import { getStreak } from "@/server/services/engagement";

export const metadata: Metadata = { title: "Fortschritt" };

const RANGES = { "7d": 7, "30d": 30, "3m": 91, "6m": 182, "1y": 365 } as const;
type RangeKey = keyof typeof RANGES;

export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const sp = await searchParams;
  const range: RangeKey = typeof sp.range === "string" && sp.range in RANGES ? (sp.range as RangeKey) : "30d";
  const ctx = await getServiceContext();
  const today = todayInTimezone(ctx.timezone);
  const from = addDays(today, -(RANGES[range] - 1));
  const [rows, trend, streak] = await Promise.all([
    getDailyTotals(ctx, from, today),
    getWeightTrend(ctx, { from, to: today }),
    getStreak(ctx),
  ]);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const data: DayPoint[] = dateRange(from, today).map((date) => {
    const r = byDate.get(date);
    return {
      date,
      kcal: r ? Math.round(r.totals.kcal) : null,
      proteinG: r ? Math.round(r.totals.proteinG) : null,
      targetKcal: r?.targets?.calories ?? null,
      targetProtein: r?.targets?.proteinG ?? null,
    };
  });
  const logged = rows.length;
  const avg = (f: (r: (typeof rows)[number]) => number) =>
    logged ? rows.reduce((s, r) => s + f(r), 0) / logged : 0;
  const withTarget = rows.filter((r) => r.targets);
  const inRange = withTarget.filter(
    (r) => Math.abs(r.totals.kcal - r.targets!.calories) <= r.targets!.calories * 0.1,
  ).length;
  const proteinHit = withTarget.filter((r) => r.totals.proteinG >= r.targets!.proteinG).length;
  const lastTarget = [...rows].reverse().find((r) => r.targets)?.targets ?? null;
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "–");

  return (
    <main className="mx-auto w-full max-w-content space-y-5 px-gutter py-6 lg:max-w-wide lg:px-8 lg:pt-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="text-title lg:text-[2.25rem]">Fortschritt</h1>
        <div className="lg:w-96">
          <RangeSwitch value={range} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label="Ø Kalorien" value={formatNumber(avg((r) => r.totals.kcal))} unit="kcal" />
        <StatTile label="Ø Protein" value={formatNumber(avg((r) => r.totals.proteinG))} unit="g" />
        <StatTile label="Im Kalorienziel (±10 %)" value={pct(inRange, withTarget.length)} />
        <StatTile label="Protein-Ziel erreicht" value={pct(proteinHit, withTarget.length)} />
        <StatTile label="Geloggte Tage" value={`${logged} / ${RANGES[range]}`} />
        <StatTile label="Serie" value={`${streak.current} Tage`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-2 rounded-card bg-card p-card shadow-xs">
          <h2 className="text-headline">Kalorien</h2>
          <CaloriesChart data={data} target={lastTarget?.calories ?? null} />
        </section>
        <section className="space-y-2 rounded-card bg-card p-card shadow-xs">
          <h2 className="text-headline">Protein</h2>
          <ProteinChart data={data} target={lastTarget?.proteinG ?? null} />
        </section>
        <section className="space-y-2 rounded-card bg-card p-card shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-headline">Gewicht (Trend)</h2>
            <Link href="/progress/weight" className="text-body-sm text-primary-strong">
              Details
            </Link>
          </div>
          {trend.points.some((p) => p.weightKg != null) ? (
            <WeightTrendChart
              points={trend.points}
              goalKg={trend.goal?.targetKg ?? null}
              range={range === "7d" ? "30d" : range}
              compact
            />
          ) : (
            <p className="text-body-sm text-muted-foreground">
              Noch keine Gewichtseinträge in diesem Zeitraum.
            </p>
          )}
        </section>
        <section className="rounded-card bg-card p-card shadow-xs">
          <h2 className="text-headline">Ø Makroverteilung</h2>
          <p className="text-body text-muted-foreground tabular">
            Protein {formatNumber(avg((r) => r.totals.proteinG))} g · Kohlenhydrate{" "}
            {formatNumber(avg((r) => r.totals.carbsG))} g · Fett {formatNumber(avg((r) => r.totals.fatG))} g
          </p>
        </section>
      </div>
    </main>
  );
}
