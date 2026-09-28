"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MacroBar } from "@/components/ui/macro-bar";
import { NumberInput } from "@/components/ui/number-input";
import { formatNumber } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import {
  addEntryAction,
  deleteEntryAction,
  duplicateEntryAction,
  restoreEntryAction,
  toggleFavoriteAction,
  updateEntryAction,
} from "@/app/(app)/log/actions";
import { MealPicker, type MealOption } from "./meal-picker";

export interface LogFoodFormProps {
  food: {
    id: string;
    name: string;
    brandName: string | null;
    basis: "g" | "ml";
    per100: { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null; sugarG: number | null };
    servings: { id: string; label: string; grams: number; isDefault?: boolean }[];
    isFavorite: boolean;
    source: string;
  };
  meals: MealOption[];
  date: string;
  initial: { mealId: string; servingId: string | null; quantity: number };
  /** Set when editing an existing entry. */
  entryId?: string;
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  returnTo: string;
}

export function LogFoodForm({ food, meals, date, initial, entryId, targets, returnTo }: LogFoodFormProps) {
  const router = useRouter();
  const [servingId, setServingId] = useState<string | null>(initial.servingId);
  const [quantity, setQuantity] = useState<number | null>(initial.quantity);
  const [mealId, setMealId] = useState(initial.mealId);
  const [favorite, setFavorite] = useState(food.isFavorite);

  const serving = food.servings.find((s) => s.id === servingId) ?? null;
  const grams = (serving?.grams ?? 100) * (quantity ?? 0);
  const n = useMemo(() => {
    const f = grams / 100;
    return {
      kcal: food.per100.kcal * f,
      proteinG: food.per100.proteinG * f,
      carbsG: food.per100.carbsG * f,
      fatG: food.per100.fatG * f,
    };
  }, [grams, food.per100]);

  const done = () => {
    router.push(returnTo);
    router.refresh();
  };
  const save = useAction(entryId ? updateEntryAction.bind(null, entryId) : addEntryAction, {
    onSuccess: () => {
      toast.success(entryId ? "Eintrag aktualisiert" : `${food.name} geloggt`);
      done();
    },
  });
  const remove = useAction(deleteEntryAction, {
    onSuccess: (row) => {
      toast("Eintrag gelöscht", { action: { label: "Rückgängig", onClick: () => void restoreEntryAction(row).then(() => router.refresh()) } });
      done();
    },
  });
  const duplicate = useAction(duplicateEntryAction, { onSuccess: () => { toast.success("Eintrag dupliziert"); done(); } });
  const fav = useAction(toggleFavoriteAction, { onSuccess: (v) => setFavorite(v) });

  const valid = quantity != null && quantity > 0;
  const submit = () => {
    if (!valid) return;
    void save.execute({ date, mealId, foodId: food.id, servingId, quantity: quantity! });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-title">{food.name}</h1>
          {food.brandName && <p className="text-body text-muted-foreground">{food.brandName}</p>}
          {food.source === "off" && <p className="mt-1 text-caption text-muted-foreground">Quelle: Open Food Facts</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={favorite}
          aria-label={favorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
          onClick={() => fav.execute(food.id)}
        >
          <Star className={cn(favorite && "fill-kcal text-kcal")} />
        </Button>
      </div>

      <section className="rounded-card bg-card p-card shadow-xs">
        <div className="text-center">
          <div className="tabular text-display font-semibold">{formatNumber(n.kcal)}</div>
          <div className="text-body-sm text-muted-foreground">kcal · {formatNumber(grams)} {food.basis}</div>
        </div>
        <div className="mt-5 grid gap-3">
          {(
            [
              ["Protein", n.proteinG, targets?.proteinG, "protein"],
              ["Kohlenhydrate", n.carbsG, targets?.carbsG, "carbs"],
              ["Fett", n.fatG, targets?.fatG, "fat"],
            ] as const
          ).map(([label, v, t, tone]) =>
            t ? (
              <MacroBar key={label} label={label} consumed={v} target={t} tone={tone} size="sm" showRemaining={false} decimals={1} />
            ) : (
              <div key={label} className="flex justify-between text-body-sm">
                <span>{label}</span>
                <span className="tabular">{formatNumber(v, { maxFractionDigits: 1 })} g</span>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-headline">Portion</h2>
        <div role="radiogroup" aria-label="Portion" className="flex flex-wrap gap-2">
          {[{ id: null, label: `100 ${food.basis}` }, ...food.servings.filter((s) => !/^100\s?(g|ml)$/.test(s.label))].map(
            (s) => (
              <button
                key={s.id ?? "base"}
                type="button"
                role="radio"
                aria-checked={servingId === s.id}
                onClick={() => {
                  setServingId(s.id);
                  if (s.id === null && quantity === 1 && serving) setQuantity(serving.grams / 100);
                }}
                className={cn(
                  "focus-ring min-h-10 rounded-control border px-3.5 text-body-sm",
                  servingId === s.id ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card",
                )}
              >
                {s.label}
              </button>
            ),
          )}
        </div>
        <NumberInput
          aria-label="Menge"
          value={quantity}
          onValueChange={setQuantity}
          min={0.01}
          max={10000}
          step={servingId ? 0.5 : 0.1}
          decimals={2}
          unit={servingId ? `× ${serving?.label}` : `× 100 ${food.basis}`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-headline">Mahlzeit</h2>
        <MealPicker meals={meals} value={mealId} onChange={setMealId} />
      </section>

      <div className="space-y-2 pb-4">
        <Button block size="lg" onClick={submit} disabled={!valid} loading={save.isPending}>
          {entryId ? "Speichern" : `Hinzufügen · ${formatNumber(n.kcal)} kcal`}
        </Button>
        {entryId && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" block onClick={() => duplicate.execute(entryId)} loading={duplicate.isPending}>
              <Copy /> Duplizieren
            </Button>
            <Button variant="outline" block onClick={() => remove.execute(entryId)} loading={remove.isPending}>
              <Trash2 /> Löschen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
