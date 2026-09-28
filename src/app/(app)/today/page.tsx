import type { Metadata } from "next";
import Link from "next/link";
import { Flame } from "lucide-react";
import { CalorieBudget } from "@/components/ui/calorie-budget";
import { MacroBar } from "@/components/ui/macro-bar";
import { MascotCoach } from "@/components/mascot/coach";
import { MealSummary } from "@/components/dashboard/meal-summary";
import { CopyYesterdayButton } from "@/components/dashboard/copy-yesterday-button";
import { WaterCard } from "@/components/water";
import { ActivityCard } from "@/components/activity";
import { WeightSummaryCard } from "@/components/weight/weight-summary-card";
import { addDays, todayInTimezone } from "@/lib/dates";
import { formatDateLong, formatNumber } from "@/lib/format";
import { getServiceContext } from "@/server/auth/context";
import { getActivitySummary } from "@/server/services/activity";
import { getMascotMessage, getStreak } from "@/server/services/engagement";
import { getDaySummary } from "@/server/services/nutrition";
import { getCurrentWeight } from "@/server/services/profile";
import { getWaterSummary } from "@/server/services/water";
import { getWeightTrend } from "@/server/services/weight";

export const metadata: Metadata = { title: "Heute" };

export default async function TodayPage() {
  const ctx = await getServiceContext();
  const today = todayInTimezone(ctx.timezone);
  const [day, yesterday, message, streak, water, activity, trend, weight] = await Promise.all([
    getDaySummary(ctx, today),
    getDaySummary(ctx, addDays(today, -1)),
    getMascotMessage(ctx),
    getStreak(ctx),
    getWaterSummary(ctx, today),
    getActivitySummary(ctx, today),
    getWeightTrend(ctx, { from: addDays(today, -30), to: today }),
    getCurrentWeight(ctx),
  ]);
  const t = day.targets;
  const weightKg = weight?.weightKg ?? 70;

  return (
    <main className="mx-auto w-full max-w-content space-y-5 px-gutter py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-overline text-muted-foreground">{formatDateLong(today, { weekday: true })}</p>
          <h1 className="text-title">Heute</h1>
        </div>
        {streak.current > 0 && (
          <Link
            href="/achievements"
            aria-label={`${streak.current} Tage in Folge geloggt`}
            className="focus-ring flex h-9 items-center gap-1.5 rounded-full bg-kcal-soft px-3 text-body-sm font-medium text-kcal-strong"
          >
            <Flame className="size-4" /> <span className="tabular">{streak.current}</span>
          </Link>
        )}
      </header>

      <MascotCoach message={message} />

      <section aria-label="Kalorien" className="rounded-card bg-card p-card shadow-xs">
        {t ? (
          <CalorieBudget consumed={day.consumed.kcal} target={t.calories} activity={day.activityKcal} />
        ) : (
          <p className="text-body text-muted-foreground">
            Noch kein Kalorienziel. <Link className="text-primary-strong underline" href="/settings/goals">Ziel festlegen</Link>
          </p>
        )}
        {t && (
          <div className="mt-6 grid gap-4">
            <MacroBar label="Protein" consumed={day.consumed.proteinG} target={t.proteinG} tone="protein" />
            <MacroBar label="Kohlenhydrate" consumed={day.consumed.carbsG} target={t.carbsG} tone="carbs" />
            <MacroBar label="Fett" consumed={day.consumed.fatG} target={t.fatG} tone="fat" />
          </div>
        )}
      </section>

      <section aria-labelledby="meals-h" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="meals-h" className="text-heading">Mahlzeiten</h2>
          {day.entryCount === 0 && yesterday.entryCount > 0 && <CopyYesterdayButton from={addDays(today, -1)} to={today} />}
        </div>
        <MealSummary meals={day.meals} date={today} />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
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

      {t && day.entryCount > 0 && (
        <p className="text-center text-body-sm text-muted-foreground">
          Insight: {formatNumber((day.consumed.proteinG * 4 * 100) / Math.max(day.consumed.kcal, 1))} % deiner Kalorien
          heute stammen aus Protein.
        </p>
      )}
    </main>
  );
}
