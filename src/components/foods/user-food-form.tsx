"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAction } from "@/lib/use-action";
import { archiveUserFoodAction, saveUserFoodAction } from "@/app/(app)/foods/actions";

export interface UserFoodFormValues {
  name: string;
  brandName: string | null;
  barcode: string | null;
  basis: "g" | "ml";
  servingLabel: string;
  servingGrams: number | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  saltG: number | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[1fr_9rem] items-center gap-3">
      <span className="text-body-sm">{label}</span>
      {children}
    </label>
  );
}

export function UserFoodForm({ id, initial, returnTo }: { id: string | null; initial: UserFoodFormValues; returnTo?: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const set = <K extends keyof UserFoodFormValues>(k: K, val: UserFoodFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const save = useAction(saveUserFoodAction, {
    onSuccess: (r) => {
      toast.success("Lebensmittel gespeichert");
      router.push(returnTo === "log" ? `/log/food/${r.id}` : "/foods");
      router.refresh();
    },
  });
  const archive = useAction(archiveUserFoodAction, { onSuccess: () => { router.push("/foods"); router.refresh(); } });
  const num = (k: "kcal" | "proteinG" | "carbsG" | "fatG" | "fiberG" | "sugarG" | "saltG", label: string, unit: string, required = false) => (
    <Row label={label + (required ? "" : " (optional)")}>
      <NumberInput aria-label={label} value={v[k]} onValueChange={(x) => set(k, x)} min={0} decimals={1} unit={unit} />
    </Row>
  );
  const valid = v.name.trim() && v.servingGrams && v.kcal != null && v.proteinG != null && v.carbsG != null && v.fatG != null;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void save.execute(id, {
          ...v,
          servingGrams: v.servingGrams!,
          kcal: v.kcal!,
          proteinG: v.proteinG!,
          carbsG: v.carbsG!,
          fatG: v.fatG!,
        });
      }}
    >
      <section className="space-y-3 rounded-card bg-card p-card shadow-xs">
        <Input aria-label="Name" placeholder="Name, z. B. Omas Apfelkuchen" value={v.name} onChange={(e) => set("name", e.target.value)} required />
        <Input aria-label="Marke" placeholder="Marke (optional)" value={v.brandName ?? ""} onChange={(e) => set("brandName", e.target.value || null)} />
        <Input aria-label="Barcode" placeholder="Barcode (optional)" inputMode="numeric" value={v.barcode ?? ""} onChange={(e) => set("barcode", e.target.value || null)} />
      </section>
      <section className="space-y-3 rounded-card bg-card p-card shadow-xs">
        <h2 className="text-headline">Portion</h2>
        <SegmentedControl<"g" | "ml"> block value={v.basis} onValueChange={(b) => set("basis", b)} aria-label="Einheit" options={[{ value: "g", label: "Gramm" }, { value: "ml", label: "Milliliter" }]} />
        <Input aria-label="Portionsname" value={v.servingLabel} onChange={(e) => set("servingLabel", e.target.value)} />
        <Row label="Portionsgröße">
          <NumberInput aria-label="Portionsgröße" value={v.servingGrams} onValueChange={(x) => set("servingGrams", x)} min={0.1} decimals={1} unit={v.basis} />
        </Row>
      </section>
      <section className="space-y-3 rounded-card bg-card p-card shadow-xs">
        <h2 className="text-headline">Nährwerte pro Portion</h2>
        {num("kcal", "Kalorien", "kcal", true)}
        {num("proteinG", "Protein", "g", true)}
        {num("carbsG", "Kohlenhydrate", "g", true)}
        {num("fatG", "Fett", "g", true)}
        {num("fiberG", "Ballaststoffe", "g")}
        {num("sugarG", "Zucker", "g")}
        {num("saltG", "Salz", "g")}
      </section>
      <Button type="submit" block size="lg" disabled={!valid} loading={save.isPending}>Speichern</Button>
      {id && (
        <Button type="button" variant="outline" block onClick={() => archive.execute(id)} loading={archive.isPending}>
          Löschen
        </Button>
      )}
    </form>
  );
}
