import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { MacroChips } from "@/components/ui/macro-chips";
import { DiaryMealMenu } from "@/components/diary/diary-meal-menu";
import { addDays, ISO_DATE_RE, todayInTimezone } from "@/lib/dates";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { getServiceContext } from "@/server/auth/context";
import { getDaySummary } from "@/server/services/nutrition";

export const metadata: Metadata = { title: "Tagebuch" };

export default async function DiaryPage({ params }: PageProps<"/diary/[date]">) {
  const { date } = await params;
  if (!ISO_DATE_RE.test(date) || Number.isNaN(Date.parse(date))) notFound();
  const ctx = await getServiceContext();
  const today = todayInTimezone(ctx.timezone);
  const day = await getDaySummary(ctx, date);
  const t = day.targets;
  const remaining = t ? t.calories + day.activityKcal - day.consumed.kcal : null;

  return (
    <main className="mx-auto w-full max-w-content space-y-5 px-gutter py-6">
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

      <section className="grid grid-cols-3 rounded-card bg-card p-4 text-center shadow-xs">
        <div>
          <div className="tabular text-stat-sm">{formatNumber(t?.calories ?? 0)}</div>
          <div className="text-caption text-muted-foreground">Ziel</div>
        </div>
        <div>
          <div className="tabular text-stat-sm">{formatNumber(day.consumed.kcal)}</div>
          <div className="text-caption text-muted-foreground">Gegessen</div>
        </div>
        <div>
          <div className={`tabular text-stat-sm ${remaining != null && remaining < 0 ? "text-over-strong" : ""}`}>
            {remaining == null ? "–" : formatNumber(Math.abs(remaining))}
          </div>
          <div className="text-caption text-muted-foreground">{remaining != null && remaining < 0 ? "Über Ziel" : "Übrig"}</div>
        </div>
      </section>

      {day.meals.map(({ meal, totals, entries }) => (
        <section key={meal.id} id={`meal-${meal.id}`} className="scroll-mt-4 rounded-card bg-card shadow-xs">
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <div>
              <h2 className="text-headline">{meal.name}</h2>
              <p className="tabular text-body-sm text-muted-foreground">{formatNumber(totals.kcal)} kcal</p>
            </div>
            <DiaryMealMenu date={date} mealId={meal.id} hasEntries={entries.length > 0} />
          </div>
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id}>
                <Link
                  href={e.foodId ? `/log/food/${e.foodId}?entry=${e.id}` : "#"}
                  className="focus-ring flex items-center gap-3 px-4 py-3 hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-body">{e.foodName}</div>
                    <div className="line-clamp-1 text-body-sm text-muted-foreground">
                      {e.quantity !== 1 ? `${formatNumber(e.quantity, { maxFractionDigits: 2 })} × ` : ""}
                      {e.servingLabel}
                    </div>
                    <MacroChips protein={e.totals.proteinG} carbs={e.totals.carbsG} fat={e.totals.fatG} className="mt-1" />
                  </div>
                  <span className="tabular text-body font-medium">{formatNumber(e.totals.kcal)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/log?date=${date}&meal=${meal.id}`}
            className="focus-ring flex h-12 items-center gap-2 rounded-b-card px-4 text-body-sm font-medium text-primary-strong hover:bg-accent/50"
          >
            <Plus className="size-4" /> Lebensmittel hinzufügen
          </Link>
        </section>
      ))}
    </main>
  );
}
