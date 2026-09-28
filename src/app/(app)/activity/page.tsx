import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  ActivityList,
  AddActivityCaloriesToggle,
  AddActivitySheet,
  StepsCard,
} from "@/components/activity";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-header";
import { WaterPanel } from "@/components/water";
import { ISO_DATE_RE, addDays, todayInTimezone, type IsoDate } from "@/lib/dates";
import { formatDateLong, formatRelativeDay } from "@/lib/format";
import { requireOnboardedContext } from "@/server/auth/context";
import { getActivitySummary } from "@/server/services/activity";
import { getWaterSummary } from "@/server/services/water";

export const metadata: Metadata = { title: "Aktivität" };

function resolveDate(raw: string | undefined, today: IsoDate): IsoDate {
  return raw && ISO_DATE_RE.test(raw) ? raw : today;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const ctx = await requireOnboardedContext();
  const today = todayInTimezone(ctx.timezone);
  const { date: rawDate } = await searchParams;
  const date = resolveDate(rawDate, today);
  const isToday = date === today;

  const [activity, water] = await Promise.all([getActivitySummary(ctx, date), getWaterSummary(ctx, date)]);

  return (
    <main className="mx-auto w-full max-w-content px-gutter py-6">
      <PageHeader
        eyebrow={formatRelativeDay(date, today)}
        title="Aktivität"
        subtitle={formatDateLong(date, { weekday: false })}
        actions={
          <div className="flex items-center gap-1">
            <IconButton label="Vorheriger Tag" size="sm" variant="ghost" asChild>
              <Link href={`/activity?date=${addDays(date, -1)}`}>
                <ChevronLeft />
              </Link>
            </IconButton>
            {!isToday && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/activity">Heute</Link>
              </Button>
            )}
            {isToday ? (
              <IconButton label="Nächster Tag" size="sm" variant="ghost" disabled>
                <ChevronRight />
              </IconButton>
            ) : (
              <IconButton label="Nächster Tag" size="sm" variant="ghost" asChild>
                <Link href={`/activity?date=${addDays(date, 1)}`}>
                  <ChevronRight />
                </Link>
              </IconButton>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        <section aria-labelledby="water-heading" className="flex flex-col gap-3">
          <h2 id="water-heading" className="sr-only">
            Wasser
          </h2>
          <WaterPanel date={date} isToday={isToday} goalMl={water.goalMl} entries={water.entries} timezone={ctx.timezone} />
        </section>

        <section aria-labelledby="steps-heading" className="flex flex-col gap-3">
          <h2 id="steps-heading" className="sr-only">
            Schritte
          </h2>
          <StepsCard
            date={date}
            steps={activity.steps}
            stepGoal={activity.stepGoal}
            stepsKcalEstimate={activity.stepsKcalEstimate}
            weightIsFallback={activity.weightIsFallback}
            href={null}
          />
        </section>

        <section aria-labelledby="activities-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="activities-heading" className="text-heading text-foreground">
              Aktivitäten
            </h2>
            <AddActivitySheet
              date={date}
              weightKg={activity.weightKg}
              weightIsFallback={activity.weightIsFallback}
              trigger={
                <Button variant="soft" size="sm">
                  <Plus aria-hidden="true" />
                  Hinzufügen
                </Button>
              }
            />
          </div>
          <ActivityList date={date} entries={activity.entries} isToday={isToday} />
        </section>

        <section aria-labelledby="budget-heading" className="flex flex-col gap-3 rounded-card border border-border bg-card p-card">
          <h2 id="budget-heading" className="sr-only">
            Kalorienbudget
          </h2>
          <AddActivityCaloriesToggle enabled={activity.addActivityCalories} />
        </section>
      </div>
    </main>
  );
}
