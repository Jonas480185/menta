"use client";

import { ChevronLeft, Search, SearchX, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { searchIngredientFoodsAction } from "@/app/(app)/recipes/actions";
import { AdaptiveSheet } from "@/components/ui/adaptive-sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { MacroChips } from "@/components/ui/macro-chips";
import { NumberInput } from "@/components/ui/number-input";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/tokens";
import { formatKcal, formatNumber, NBSP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IngredientFoodOption } from "@/server/services/recipes";

import { defaultAmount, draftGrams, pickableServings } from "./ingredient-draft";

export interface IngredientSelection {
  food: IngredientFoodOption;
  servingId: string | null;
  quantity: number;
}

export interface IngredientPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit an existing ingredient: opens directly at the amount step. */
  initial?: IngredientSelection | null;
  /** Never offer this food (the recipe's own linked food). */
  excludeFoodId?: string | null;
  onConfirm: (selection: IngredientSelection) => void;
}

const SEARCH_DEBOUNCE_MS = 250;

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; query: string; results: IngredientFoodOption[] };

/**
 * Ingredient picker sheet: search → food → serving + amount → "Übernehmen".
 * Self-contained (own server action, own state) so the shared food search component can
 * replace the search step later without touching the recipe builder.
 */
export function IngredientPicker({
  open,
  onOpenChange,
  initial,
  excludeFoodId,
  onConfirm,
}: IngredientPickerProps) {
  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Zutat bearbeiten" : "Zutat hinzufügen"}
      description={initial ? undefined : "Lebensmittel oder eigenes Rezept suchen"}
      snapPoints={[1]}
    >
      {open && (
        <PickerBody
          key={initial?.food.id ?? "new"}
          initial={initial ?? null}
          excludeFoodId={excludeFoodId ?? null}
          onConfirm={(sel) => {
            onConfirm(sel);
            onOpenChange(false);
          }}
        />
      )}
    </AdaptiveSheet>
  );
}

function PickerBody({
  initial,
  excludeFoodId,
  onConfirm,
}: {
  initial: IngredientSelection | null;
  excludeFoodId: string | null;
  onConfirm: (selection: IngredientSelection) => void;
}) {
  const [selected, setSelected] = useState<IngredientSelection | null>(initial);
  const [query, setQuery] = useState("");

  if (selected) {
    return (
      <AmountStep
        value={selected}
        onChange={setSelected}
        onBack={initial ? undefined : () => setSelected(null)}
        onConfirm={() => onConfirm(selected)}
      />
    );
  }
  return (
    <SearchStep
      query={query}
      onQueryChange={setQuery}
      excludeFoodId={excludeFoodId}
      onPick={(food) => setSelected({ food, ...defaultAmount(food) })}
    />
  );
}

// --- Step 1: search ------------------------------------------------------------------------

function SearchStep({
  query,
  onQueryChange,
  excludeFoodId,
  onPick,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  excludeFoodId: string | null;
  onPick: (food: IngredientFoodOption) => void;
}) {
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [retry, setRetry] = useState(0);
  const requestId = useRef(0);
  const inputId = useId();
  const resultsId = useId();

  useEffect(() => {
    const q = query.trim();
    const id = ++requestId.current;
    if (!q) {
      const reset = setTimeout(() => setState({ status: "idle" }), 0);
      return () => clearTimeout(reset);
    }
    const timer = setTimeout(async () => {
      setState({ status: "loading" });
      try {
        const result = await searchIngredientFoodsAction({ query: q, excludeFoodId });
        if (id !== requestId.current) return;
        setState(
          result.ok
            ? { status: "done", query: q, results: result.data }
            : { status: "error", message: result.error.message },
        );
      } catch {
        if (id !== requestId.current) return;
        setState({ status: "error", message: "Verbindung fehlgeschlagen. Bitte versuche es erneut." });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, excludeFoodId, retry]);

  return (
    <div className="flex flex-col gap-4 pb-2">
      <label htmlFor={inputId} className="sr-only">
        Lebensmittel suchen
      </label>
      <Input
        id={inputId}
        type="search"
        autoFocus
        autoComplete="off"
        enterKeyHint="search"
        placeholder="z. B. Linsen, Kokosmilch …"
        leadingIcon={<Search aria-hidden="true" />}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-controls={resultsId}
      />

      <div id={resultsId} aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "idle" && (
          <p className="px-1 py-6 text-center text-body-sm text-muted-foreground">
            Suche nach Lebensmitteln, Marken oder deinen eigenen Rezepten.
          </p>
        )}
        {state.status === "loading" && (
          <ul className="flex flex-col gap-2" aria-label="Suche läuft">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-3 px-1 py-2">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-14" />
              </li>
            ))}
          </ul>
        )}
        {state.status === "error" && (
          <EmptyState
            size="sm"
            icon={<TriangleAlert />}
            title="Suche fehlgeschlagen"
            description={state.message}
            action={
              <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>
                Erneut versuchen
              </Button>
            }
          />
        )}
        {state.status === "done" && state.results.length === 0 && (
          <EmptyState
            size="sm"
            icon={<SearchX />}
            title={`Nichts gefunden für „${state.query}“`}
            description="Probier einen anderen Begriff oder eine kürzere Schreibweise."
          />
        )}
        {state.status === "done" && state.results.length > 0 && (
          <ul className="-mx-2 flex flex-col" aria-label="Suchergebnisse">
            {state.results.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => onPick(food)}
                  className={cn(
                    "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2.5 text-left transition-colors duration-150 hover:bg-accent active:bg-muted",
                    focusRing,
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body font-medium text-foreground">{food.name}</span>
                    <span className="truncate text-body-sm text-muted-foreground">
                      {food.source === "recipe" ? "Eigenes Rezept" : (food.brandName ?? sourceLabel(food))}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="text-body-sm font-semibold text-foreground tabular">
                      {formatKcal(food.per100.kcal)}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      pro 100{NBSP}
                      {food.basis}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function sourceLabel(food: IngredientFoodOption) {
  return food.source === "user" ? "Eigenes Lebensmittel" : "Lebensmittel";
}

// --- Step 2: serving + amount ----------------------------------------------------------------

function AmountStep({
  value,
  onChange,
  onBack,
  onConfirm,
}: {
  value: IngredientSelection;
  onChange: (v: IngredientSelection) => void;
  onBack?: () => void;
  onConfirm: () => void;
}) {
  const { food } = value;
  const servings = pickableServings(food);
  const amountId = useId();
  const [quantity, setQuantity] = useState<number | null>(value.quantity);
  const valid = quantity != null && quantity > 0;
  const grams = valid ? draftGrams({ ...value, quantity }) : 0;
  const f = grams / 100;

  const setServing = (servingId: string | null) => {
    if (servingId === value.servingId) return;
    const q = servingId ? 1 : Math.round(draftGrams(value)) || 100;
    setQuantity(q);
    onChange({ ...value, servingId, quantity: q });
  };

  const options = [
    { id: null as string | null, label: food.basis === "ml" ? "Milliliter" : "Gramm" },
    ...servings.map((s) => ({ id: s.id as string | null, label: s.label })),
  ];

  return (
    <form
      className="flex flex-col gap-5 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        // The sheet is portalled, but React events still bubble to a parent <form>.
        e.stopPropagation();
        if (valid) onConfirm();
      }}
    >
      <div className="flex items-start gap-2">
        {onBack && (
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Andere Zutat wählen">
            <ChevronLeft />
          </Button>
        )}
        <div className="flex min-w-0 flex-col gap-0.5 pt-1.5">
          <p className="text-headline text-foreground">{food.name}</p>
          <p className="text-body-sm text-muted-foreground">
            {formatKcal(food.per100.kcal)} pro 100{NBSP}
            {food.basis}
            {food.brandName ? ` · ${food.brandName}` : ""}
          </p>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body-sm font-medium text-foreground">Einheit</legend>
        <div role="radiogroup" aria-label="Einheit" className="flex flex-wrap gap-2">
          {options.map((o) => {
            const checked = o.id === value.servingId;
            return (
              <button
                key={o.id ?? "base"}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setServing(o.id)}
                className={cn(
                  "min-h-11 cursor-pointer rounded-full border px-4 text-body-sm font-medium transition-colors duration-150",
                  checked
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-accent",
                  focusRing,
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={amountId} className="text-body-sm font-medium text-foreground">
          {value.servingId ? "Anzahl" : "Menge"}
        </label>
        <NumberInput
          id={amountId}
          value={quantity}
          min={0}
          max={100_000}
          step={value.servingId ? 0.5 : 10}
          decimals={value.servingId ? 2 : 1}
          unit={value.servingId ? "×" : food.basis}
          onValueChange={(q) => {
            setQuantity(q);
            if (q != null && q > 0) onChange({ ...value, quantity: q });
          }}
          aria-invalid={!valid || undefined}
          aria-describedby={`${amountId}-preview`}
        />
        {!valid && <p className="text-body-sm text-destructive">Bitte gib eine Menge größer als 0 an.</p>}
      </div>

      <div
        id={`${amountId}-preview`}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card bg-surface-inset px-4 py-3"
      >
        <span className="text-body-sm text-muted-foreground tabular">
          {formatNumber(grams, { maxFractionDigits: grams < 10 ? 1 : 0 })}
          {NBSP}
          {food.basis} ={" "}
          <span className="font-semibold text-foreground">{formatKcal(food.per100.kcal * f)}</span>
        </span>
        <MacroChips
          protein={food.per100.proteinG * f}
          carbs={food.per100.carbsG * f}
          fat={food.per100.fatG * f}
        />
      </div>

      <Button type="submit" block size="lg" disabled={!valid}>
        Übernehmen
      </Button>
    </form>
  );
}
