import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { UserFoodForm } from "@/components/foods/user-food-form";

export const metadata: Metadata = { title: "Neues Lebensmittel" };

export default async function NewFoodPage({ searchParams }: PageProps<"/foods/new">) {
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const barcode = str(sp.barcode);
  return (
    <main className="mx-auto w-full max-w-content space-y-4 px-gutter py-6">
      <PageHeader
        title="Neues Lebensmittel"
        subtitle={barcode ? `Produkt mit Barcode ${barcode} ist noch unbekannt – leg es einfach an.` : undefined}
        back={{ href: barcode ? "/log" : "/foods", label: "Zurück" }}
      />
      <UserFoodForm
        id={null}
        returnTo={str(sp.from) ?? (barcode ? "log" : undefined)}
        initial={{ name: str(sp.name) ?? "", brandName: null, barcode, basis: "g", servingLabel: "1 Portion", servingGrams: 100, kcal: null, proteinG: null, carbsG: null, fatG: null, fiberG: null, sugarG: null, saltG: null }}
      />
    </main>
  );
}
