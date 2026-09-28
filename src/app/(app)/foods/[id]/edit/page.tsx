import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { UserFoodForm } from "@/components/foods/user-food-form";
import { getServiceContext } from "@/server/auth/context";
import { getUserFoodForm } from "@/server/services/user-foods";

export const metadata: Metadata = { title: "Lebensmittel bearbeiten" };

export default async function EditFoodPage({ params }: PageProps<"/foods/[id]/edit">) {
  const { id } = await params;
  const values = await getUserFoodForm(await getServiceContext(), id).catch(() => notFound());
  return (
    <main className="mx-auto w-full max-w-content space-y-4 px-gutter py-6">
      <PageHeader title="Bearbeiten" back={{ href: "/foods", label: "Zurück" }} />
      <UserFoodForm id={id} initial={{ ...values, brandName: values.brandName ?? null, barcode: values.barcode ?? null, fiberG: values.fiberG ?? null, sugarG: values.sugarG ?? null, saltG: values.saltG ?? null }} />
    </main>
  );
}
