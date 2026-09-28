import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { LogMealSwitch } from "@/components/logging/log-meal-switch";
import { LogSearch } from "@/components/logging/log-search";
import { ISO_DATE_RE, todayInTimezone } from "@/lib/dates";
import { formatRelativeDay } from "@/lib/format";
import { getServiceContext } from "@/server/auth/context";
import { getQuickPicks } from "@/server/services/foods";
import { listMeals, suggestMealId } from "@/server/services/logging";

export const metadata: Metadata = { title: "Loggen" };

export default async function LogPage({ searchParams }: PageProps<"/log">) {
  const sp = await searchParams;
  const ctx = await getServiceContext();
  const today = todayInTimezone(ctx.timezone);
  const date = typeof sp.date === "string" && ISO_DATE_RE.test(sp.date) ? sp.date : today;
  const meals = await listMeals(ctx);
  const hour = Number(new Intl.DateTimeFormat("de-DE", { hour: "numeric", timeZone: ctx.timezone }).format(new Date()));
  const mealId =
    (typeof sp.meal === "string" && meals.find((m) => m.id === sp.meal)?.id) || suggestMealId(meals, hour) || meals[0].id;
  const quickPicks = await getQuickPicks(ctx, 10);

  return (
    <main className="mx-auto w-full max-w-content space-y-4 px-gutter py-6">
      <PageHeader
        title="Loggen"
        subtitle={formatRelativeDay(date, today)}
        back={{ href: date === today ? "/today" : `/diary/${date}`, label: "Zurück" }}
      />
      <LogMealSwitch meals={meals.map((m) => ({ id: m.id, name: m.name }))} value={mealId} date={date} />
      <LogSearch key={mealId} date={date} mealId={mealId} quickPicks={quickPicks} />
    </main>
  );
}
