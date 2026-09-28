import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { LogFoodForm } from "@/components/logging/log-food-form";
import { ISO_DATE_RE, todayInTimezone } from "@/lib/dates";
import { isAppError } from "@/lib/errors";
import { getServiceContext } from "@/server/auth/context";
import { mealEntries } from "@/server/db/schema";
import { getFoodForUser } from "@/server/services/foods";
import { listMeals, suggestMealId } from "@/server/services/logging";
import { getDailyTargets } from "@/server/services/nutrition";

export const metadata: Metadata = { title: "Lebensmittel" };

export default async function LogFoodPage({ params, searchParams }: PageProps<"/log/food/[foodId]">) {
  const [{ foodId }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getServiceContext();
  const food = await getFoodForUser(ctx, foodId).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  const today = todayInTimezone(ctx.timezone);
  const meals = await listMeals(ctx);

  const entryParam = typeof sp.entry === "string" ? sp.entry : undefined;
  const [entry] = entryParam
    ? await ctx.db
        .select()
        .from(mealEntries)
        .where(and(eq(mealEntries.id, entryParam), eq(mealEntries.userId, ctx.userId)))
    : [];
  const date = entry?.date ?? (typeof sp.date === "string" && ISO_DATE_RE.test(sp.date) ? sp.date : today);
  const hour = Number(new Intl.DateTimeFormat("de-DE", { hour: "numeric", timeZone: ctx.timezone }).format(new Date()));
  const mealId =
    entry?.mealId ??
    ((typeof sp.meal === "string" && meals.find((m) => m.id === sp.meal)?.id) ||
      food.lastUsage?.mealId ||
      suggestMealId(meals, hour) ||
      meals[0].id);

  const defaultServing = food.servings.find((s) => s.isDefault) ?? null;
  const lastServing = food.servings.find((s) => s.id === food.lastUsage?.servingId) ?? null;
  const initialServing = entry ? entry.servingId : (lastServing ?? defaultServing)?.id ?? null;
  const initialQuantity = entry?.quantity ?? (lastServing ? (food.lastUsage?.quantity ?? 1) : 1);
  const targets = await getDailyTargets(ctx, date);

  return (
    <main className="mx-auto w-full max-w-content space-y-4 px-gutter py-6">
      <PageHeader title="" back={{ href: entry ? `/diary/${date}` : `/log?date=${date}&meal=${mealId}`, label: "Zurück" }} />
      <LogFoodForm
        food={{
          id: food.id,
          name: food.name,
          brandName: food.brandName,
          basis: food.nutrientBasis,
          per100: {
            kcal: food.nutrients.kcal,
            proteinG: food.nutrients.proteinG,
            carbsG: food.nutrients.carbsG,
            fatG: food.nutrients.fatG,
            fiberG: food.nutrients.fiberG ?? null,
            sugarG: food.nutrients.sugarG ?? null,
          },
          servings: food.servings.map((s) => ({ id: s.id, label: s.label, grams: s.grams, isDefault: s.isDefault })),
          isFavorite: food.isFavorite,
          source: food.source,
        }}
        meals={meals.map((m) => ({ id: m.id, name: m.name }))}
        date={date}
        initial={{ mealId, servingId: initialServing, quantity: initialQuantity }}
        entryId={entry?.id}
        targets={targets ? { calories: targets.calories, proteinG: targets.proteinG, carbsG: targets.carbsG, fatG: targets.fatG } : null}
        returnTo={date === today ? "/today" : `/diary/${date}`}
      />
    </main>
  );
}
