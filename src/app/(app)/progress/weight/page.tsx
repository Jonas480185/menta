import type { Metadata } from "next";

import { todayInTimezone } from "@/lib/dates";
import { requireOnboardedContext } from "@/server/auth/context";
import { getWeightTrend, listWeights } from "@/server/services/weight";

import { WeightProgressView } from "./_components/weight-progress-view";

export const metadata: Metadata = { title: "Gewicht" };

export default async function WeightPage() {
  const ctx = await requireOnboardedContext();
  const today = todayInTimezone(ctx.timezone);
  // Full history once: range switching happens on the client without refetching.
  const [trend, entries] = await Promise.all([getWeightTrend(ctx), listWeights(ctx, { to: today })]);

  return (
    <main className="mx-auto w-full max-w-content px-gutter py-6">
      <WeightProgressView trend={trend} entries={entries} today={today} />
    </main>
  );
}
