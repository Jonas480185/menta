import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { MacroBar } from "@/components/ui/macro-bar";
import { MacroChips } from "@/components/ui/macro-chips";
import { DiaryMealMenu } from "@/components/diary/diary-meal-menu";
import { MealIcon } from "@/components/dashboard/meal-icon";
import { buildWeek, weekStart } from "@/components/dashboard/week";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { addDays, ISO_DATE_RE, todayInTimezone } from "@/lib/dates";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { getServiceContext } from "@/server/auth/context";
import { getDailyTotals, getDaySummary } from "@/server/services/nutrition";

export const metadata: Metadata = { title: "Tagebuch" };

export default async function DiaryPage({ params }: PageProps<"/diary/[date]">) {
  const { date } = await params;
  if (!ISO_DATE_RE.test(date) || Number.isNaN(Date.parse(date))) notFound();
  const ctx = await getServiceContext();
  const today = todayInTimezone(ctx.timezone);
  const from = weekStart(date);
  const to = addDays(from, 6) < today ? addDays(from, 6) : today;
  const [day, weekRows] = await Promise.all([getDaySummary(ctx, date), getDailyTotals(ctx, from, to)]);
  const t = day.targets;
  const budget = t ? t.calories + day.activityKcal : null;
  const remaining = budget != null ? budget - day.consumed.kcal : null;
  const fill = budget ? Math.min(1, day.consumed.kcal / budget) : 0;
  const week = buildWeek(
    date,
    weekRows.map((r) => ({ date: r.date, kcal: r.totals.kcal, target: r.targets?.calories ?? null })),
    t?.calories ?? null,
  );

  return (
    <main className="mx-auto w-full max-w-content px-gutter py-6 lg:grid lg:max-w-wide lg:grid-cols-[23rem_minmax(0,1fr)] lg:items-start lg:gap-8 lg:px-8 lg:pt-8">
      <div className="space-y-5 lg:sticky lg:top-8">
        <header className="flex items-center justify-between gap-2">
          <IconButton asChild variant="ghost" label="Vorheriger Tag">
            <Link href={`/diary/${addDays(date, -1)}`}>
              <ChevronLeft />
            </Link>
          </IconButton>
          <div className="text-center">
            <h1 className="text-title">{formatRelativeDay(date, today)}</h1>
            {date !== today && (
              <Link href={`/diary/${today}`} className="text-body-sm text-primary-strong">
                Zu heute
              </Link>
            )}
          </div>
          <IconButton asChild variant="ghost" label="Nächster Tag">
            <Link href={`/diary/${addDays(date, 1)}`}>
              <ChevronRight />
            </Link>
          </IconButton>
        </header>

        <WeekStrip days={week} selected={date} today={today} />

        <section aria-label="Tagesbilanz" className="rounded-card bg-card p-4 shadow-xs">
          <div className="grid grid-cols-3 text-center">
            <div>
              <div className="text-stat-sm tabular">{formatNumber(day.consumed.kcal)}</div>
              <div className="text-caption text-muted-foreground">Gegessen</div>
            </div>
            <div>
              <div className="text-stat-sm tabular">{formatNumber(budget ?? 0)}</div>
              <div className="text-caption text-muted-foreground">Ziel</div>
            </div>
            <div>
              <div
                className={`text-stat-sm tabular ${remaining != null && remaining < 0 ? "text-over-strong" : "text-primary-strong"}`}
              >
                {remaining == null ? "–" : formatNumber(Math.abs(remaining))}
              </div>
              <div className="text-caption text-muted-foreground">
                {remaining != null && remaining < 0 ? "Über Ziel" : "Übrig"}
              </div>
            </div>
          </div>
          {budget != null && (
            <div aria-hidden className="mt-3 h-2 overflow-hidden rounded-full bg-track">
              <div
                className={`h-full origin-left rounded-full transition-transform duration-500 ${remaining != null && remaining < 0 ? "bg-over" : "bg-kcal"}`}
                style={{ transform: `scaleX(${fill})` }}
              />
            </div>
          )}
        </section>

        {t && (
          <section
            aria-label="Makros"
            className="hidden space-y-4 rounded-card bg-card p-card shadow-xs lg:block"
          >
            <MacroBar label="Protein" consumed={day.consumed.proteinG} target={t.proteinG} tone="protein" />
            <MacroBar label="Kohlenhydrate" consumed={day.consumed.carbsG} target={t.carbsG} tone="carbs" />
            <MacroBar label="Fett" consumed={day.consumed.fatG} target={t.fatG} tone="fat" />
          </section>
        )}
      </div>

      <div className="mt-5 space-y-5 lg:mt-0">
        {day.meals.map(({ meal, totals, entries }) => (
          <section
            key={meal.id}
            id={`meal-${meal.id}`}
            className="scroll-mt-4 rounded-card bg-card shadow-xs lg:scroll-mt-8"
          >
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <MealIcon name={meal.name} className="size-10" />
              <div className="min-w-0 flex-1">
                <h2 className="text-headline">{meal.name}</h2>
                <p className="text-body-sm text-muted-foreground tabular">{formatNumber(totals.kcal)} kcal</p>
              </div>
              <DiaryMealMenu date={date} mealId={meal.id} hasEntries={entries.length > 0} />
            </div>
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id}>
                  <Link
                    href={e.foodId ? `/log/food/${e.foodId}?entry=${e.id}` : "#"}
                    className="flex items-center gap-3 px-4 py-3 focus-ring hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-body">{e.foodName}</div>
                      <div className="line-clamp-1 text-body-sm text-muted-foreground">
                        {e.quantity !== 1 ? `${formatNumber(e.quantity, { maxFractionDigits: 2 })} × ` : ""}
                        {e.servingLabel}
                      </div>
                      <MacroChips
                        protein={e.totals.proteinG}
                        carbs={e.totals.carbsG}
                        fat={e.totals.fatG}
                        className="mt-1"
                      />
                    </div>
                    <span className="text-body font-medium tabular">{formatNumber(e.totals.kcal)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={`/log?date=${date}&meal=${meal.id}`}
              className="flex h-12 items-center gap-2 rounded-b-card px-4 text-body-sm font-medium text-primary-strong focus-ring hover:bg-accent/50"
            >
              <Plus className="size-4" /> Lebensmittel hinzufügen
            </Link>
          </section>
        ))}
      </div>
    </main>
  );
}
