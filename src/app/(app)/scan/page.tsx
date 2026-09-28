import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { BarcodeScanner } from "@/components/barcode/barcode-scanner";

export const metadata: Metadata = { title: "Barcode scannen" };

export default async function ScanPage({ searchParams }: PageProps<"/scan">) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (typeof sp.date === "string") q.set("date", sp.date);
  if (typeof sp.meal === "string") q.set("meal", sp.meal);
  return (
    <main className="mx-auto w-full max-w-content space-y-4 px-gutter py-6">
      <PageHeader title="Barcode scannen" back={{ href: `/log?${q}`, label: "Zurück" }} />
      <BarcodeScanner query={q.toString()} />
    </main>
  );
}
