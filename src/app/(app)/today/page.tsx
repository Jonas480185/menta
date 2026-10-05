import type { Metadata } from "next";
import Link from "next/link";
import { Flame } from "lucide-react";
import { MascotCoach } from "@/components/mascot/coach";
import { DailyOverview } from "@/components/dashboard/daily-overview";
import { MealSummary } from "@/components/dashboard/meal-summary";
import { CopyYesterdayButton } from "@/components/dashboard/copy-yesterday-button";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { buildWeek, weekStart } from "@/components/dashboard/week";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { WaterCard } from "@/components/water";
import { ActivityCard } from "@/components/activity";
import { WeightSummaryCard } from "@/components/weight/weight-summary-card";
import { addDays, todayInTimezone } from "@/lib/dates";
import { formatDateLong, formatNumber } from "@/lib/format";
import { getCurrentUser, getServiceContext } from "@/server/auth/context";
import { getActivitySummary } from "@/server/services/activity";
import { getMascotMessage, getStreak } from "@/server/services/engagement";
import { getDailyTotals, getDaySummary } from "@/server/services/nutrition";
import { getCurrentWeight } from "@/server/services/profile";
import { getWaterSummary } from "@/server/services/water";
import { getWeightTrend } from "@/server/services/weight";

export const metadata: Metadata = { title: "Heute" };

export default async function TodayPage() {
  const ctx = await getServiceContext();
  const today = todayInTimezone(ctx.timezone);
  const [day, yesterday, message, streak, water, activity, trend, weight, weekRows, user] = await Promise.all([
    getDaySummary(ctx, today),
    getDaySummary(ctx, addDays(today, -1)),
    getMascotMessage(ctx),
    getStreak(ctx),
    getWaterSummary(ctx, today),
    getActivitySummary(ctx, today),
    getWeightTrend(ctx, { from: addDays(today, -30), to: today }),
    getCurrentWeight(ctx),
    getDailyTotals(ctx, weekStart(today), today),
    getCurrentUser(),
  ]);
  const t = day.targets;
  const weightKg = weight?.weightKg ?? 70;
  const week = buildWeek(
    today,
    weekRows.map((r) => ({ date: r.date, kcal: r.totals.kcal, target: r.targets?.calories ?? null })),
    t?.calories ?? null,
  );

  const hour = Number(new Intl.DateTimeFormat("de-DE", { hour: "numeric", hourCycle: "h23", timeZone: ctx.timezone }).format(new Date()));
  const greeting = hour < 5 ? "Gute Nacht" : hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";
  const firstName = user?.name?.trim().split(/\s+/)[0];

  // Mobile: one column in reading order (via `order-*`). Desktop: main column + side rail.
  return (
    <main className="mx-auto w-full max-w-content px-gutter pb-6 lg:max-w-wide lg:px-8">
      <header className="sticky top-0 z-30 -mx-gutter mb-4 flex items-center justify-between bg-background/85 px-gutter pt-safe-offset-4 pb-3 backdrop-blur-lg lg:static lg:mx-0 lg:mb-6 lg:bg-transparent lg:px-0 lg:pt-8 lg:backdrop-blur-none">
        <div>
          <p className="text-overline text-muted-foreground uppercase">{formatDateLong(today, { weekday: true })}</p>
          <h1 className="text-title lg:text-[2.25rem]">
            <span className="lg:hidden">Heute</span>
            <span className="hidden lg:inline">
              {greeting}
              {firstName ? `, ${firstName}` : ""}
            </span>
          </h1>
        </div>
        {streak.current > 0 && (
          <Link
            href="/achievements"
            aria-label={`${streak.current} Tage in Folge geloggt`}
            className="focus-ring flex h-11 items-center gap-1.5 rounded-full bg-kcal-soft px-3.5 text-body-sm font-semibold text-kcal-strong transition-transform hover:scale-105 active:scale-95"
          >
            <Flame className="size-4 fill-current" /> <span className="tabular">{streak.current}</span>
            <span className="hidden lg:inline">Tage Serie</span>
          </Link>
        )}
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-6">
        {/* main column */}
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <div className="order-3 lg:order-none">
            {t ? (
              <DailyOverview
                consumedKcal={day.consumed.kcal}
                targetKcal={t.calories}
                budgetActivityKcal={day.activityKcal}
                burnedKcal={activity.activeKcal}
                macros={day.consumed}
                macroTargets={t}
                href={`/diary/${today}`}
              />
            ) : (
              <section aria-label="Kalorien" className="rounded-card bg-card p-card shadow-xs">
                <p className="text-body text-muted-foreground">
                  Noch kein Kalorienziel. <Link className="text-primary-strong underline" href="/settings/goals">Ziel festlegen</Link>
                </p>
              </section>
            )}
          </div>

          <QuickActions className="order-4 lg:order-none" />

          <section aria-labelledby="meals-h" className="order-5 space-y-3 pt-2 lg:order-none lg:pt-0">
            <div className="flex items-center justify-between">
              <h2 id="meals-h" className="text-heading">Ernährung</h2>
              {day.entryCount === 0 && yesterday.entryCount > 0 ? (
                <CopyYesterdayButton from={addDays(today, -1)} to={today} />
              ) : (
                <Link href={`/diary/${today}`} className="focus-ring rounded-sm text-body-sm font-medium text-primary-strong hover:underline">
                  Tagebuch öffnen
                </Link>
              )}
            </div>
            <MealSummary meals={day.meals} date={today} />
          </section>

          {t && day.entryCount > 0 && (
            <p className="order-9 text-center text-body-sm text-muted-foreground lg:order-none lg:text-left">
              Insight: {formatNumber((day.consumed.proteinG * 4 * 100) / Math.max(day.consumed.kcal, 1))} % deiner Kalorien
              heute stammen aus Protein.
            </p>
          )}
        </div>

        {/* side rail */}
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <WeekStrip className="order-1 lg:order-none" days={week} selected={today} today={today} todayHref={`/diary/${today}`} />
          <div className="order-2 lg:order-none">
            <MascotCoach message={message} />
          </div>
          <h2 className="order-6 pt-2 text-heading lg:order-none lg:pt-2">Aktivität & Körper</h2>
          <div className="order-7 grid gap-4 sm:grid-cols-2 lg:order-none lg:grid-cols-1">
            <WaterCard date={today} totalMl={water.totalMl} goalMl={water.goalMl} href="/activity" />
            <ActivityCard
              date={today}
              activeKcal={activity.activeKcal}
              minutes={activity.minutes}
              count={activity.entries.length}
              weightKg={weightKg}
              weightIsFallback={!weight}
              href="/activity"
            />
          </div>
          <div className="order-8 lg:order-none">
            <WeightSummaryCard
              today={today}
              href="/progress/weight"
              data={{
                points: trend.points,
                current: trend.current,
                trendCurrent: trend.trendCurrent,
                change7d: trend.change7d,
                entryCount: trend.points.filter((p) => p.weightKg != null).length,
                goal: trend.goal ? { targetKg: trend.goal.targetKg, direction: trend.goal.direction } : null,
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
