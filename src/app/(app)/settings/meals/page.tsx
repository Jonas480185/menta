import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { MealsEditor } from "@/components/settings/meals-editor";
import { getServiceContext } from "@/server/auth/context";
import { listMeals } from "@/server/services/logging";

export const metadata: Metadata = { title: "Mahlzeiten" };

export default async function MealsPage() {
  const meals = await listMeals(await getServiceContext());
  return (
    <main className="mx-auto w-full max-w-content space-y-4 px-gutter py-6">
      <PageHeader title="Mahlzeiten" back={{ href: "/settings", label: "Profil" }} />
      <MealsEditor meals={meals.map((m) => ({ id: m.id, name: m.name }))} />
    </main>
  );
}
