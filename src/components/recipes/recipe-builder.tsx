"use client";

import { Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { createRecipeAction, updateRecipeAction } from "@/app/(app)/recipes/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Textarea } from "@/components/ui/textarea";
import { aggregateRecipe, RECIPE_LIMITS, RecipeInputSchema, type RecipeAggregate } from "@/domain/recipes";
import { formatGrams, formatKcal, formatNumber } from "@/lib/format";
import type { FieldErrors } from "@/lib/errors";
import { useAction } from "@/lib/use-action";

import {
  draftAmountLabel,
  draftGrams,
  draftKcal,
  newDraftKey,
  type IngredientDraft,
} from "./ingredient-draft";
import { IngredientPicker, type IngredientSelection } from "./ingredient-picker";
import { RecipeNutritionSummary } from "./recipe-nutrition-summary";

export interface RecipeBuilderInitial {
  id: string;
  foodId: string | null;
  name: string;
  description: string | null;
  servings: number;
  totalWeightG: number | null;
  ingredients: IngredientDraft[];
}

export interface RecipeBuilderProps {
  /** Existing recipe (edit mode). Omit to create a new recipe. */
  initial?: RecipeBuilderInitial;
}

/** Recipe editor: name, portions, cooked weight, ingredients and a live nutrition summary. */
export function RecipeBuilder({ initial }: RecipeBuilderProps) {
  const router = useRouter();
  const ids = { name: useId(), description: useId(), weight: useId(), ingredients: useId() };

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [servings, setServings] = useState(initial?.servings ?? 4);
  const [totalWeightG, setTotalWeightG] = useState<number | null>(initial?.totalWeightG ?? null);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(initial?.ingredients ?? []);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const editing = editingKey ? (ingredients.find((i) => i.key === editingKey) ?? null) : null;

  const onSaved = (data: { id: string }) => {
    router.push(`/recipes/${data.id}`);
  };
  const create = useAction(createRecipeAction, { successMessage: "Rezept gespeichert", onSuccess: onSaved });
  const update = useAction(updateRecipeAction, {
    successMessage: "Änderungen gespeichert",
    onSuccess: onSaved,
  });
  const action = initial ? update : create;
  const isPending = action.isPending;
  const errors: FieldErrors = { ...action.fieldErrors, ...localErrors };
  const errorOf = (key: string) => errors[key]?.[0];

  const nutrition: RecipeAggregate | null = useMemo(() => {
    try {
      return aggregateRecipe({
        servings: servings > 0 ? servings : 1,
        totalWeightG: totalWeightG && totalWeightG > 0 ? totalWeightG : null,
        ingredients: ingredients.map((i) => ({
          per100: i.food.per100,
          grams: draftGrams(i),
          basis: i.food.basis,
          densityGPerMl: i.food.densityGPerMl,
        })),
      });
    } catch {
      return null;
    }
  }, [ingredients, servings, totalWeightG]);

  const weightTooLow =
    nutrition != null && ingredients.length > 0 && nutrition.totalWeightG + 1e-6 < nutrition.minTotalWeightG;

  const openAdd = () => {
    setEditingKey(null);
    setPickerOpen(true);
  };
  const openEdit = (key: string) => {
    setEditingKey(key);
    setPickerOpen(true);
  };
  const onPicked = (sel: IngredientSelection) => {
    setLocalErrors((e) => ({ ...e, ingredients: [] }));
    action.reset();
    if (editingKey) {
      setIngredients((list) => list.map((i) => (i.key === editingKey ? { ...i, ...sel } : i)));
    } else {
      setIngredients((list) => [...list, { key: newDraftKey(), ...sel }]);
    }
  };
  const remove = (key: string) => {
    action.reset();
    setIngredients((list) => list.filter((i) => i.key !== key));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      description: description.trim() ? description : null,
      servings,
      totalWeightG,
      ingredients: ingredients.map((i) => ({
        foodId: i.food.id,
        servingId: i.servingId,
        quantity: i.quantity,
      })),
    };
    const parsed = RecipeInputSchema.safeParse(payload);
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "_";
        (fe[key] ??= []).push(issue.message);
      }
      setLocalErrors(fe);
      return;
    }
    setLocalErrors({});
    if (initial) void update.execute({ id: initial.id, recipe: payload });
    else void create.execute(payload);
  };

  const ingredientError =
    errorOf("ingredients") ??
    Object.entries(errors).find(([k, v]) => k.startsWith("ingredients.") && v.length > 0)?.[1][0];

  return (
    <>
      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start"
      >
        <div className="flex min-w-0 flex-col gap-6">
          {/* Basics */}
          <Card>
            <CardContent className="flex flex-col gap-5">
              <Field id={ids.name} label="Name" error={errorOf("name")}>
                <Input
                  id={ids.name}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Linsen-Dal"
                  maxLength={RECIPE_LIMITS.nameMax}
                  autoComplete="off"
                  required
                  aria-invalid={!!errorOf("name") || undefined}
                  aria-describedby={errorOf("name") ? `${ids.name}-error` : undefined}
                />
              </Field>
              <Field id={ids.description} label="Beschreibung" optional error={errorOf("description")}>
                <Textarea
                  id={ids.description}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notizen, Zubereitung, Quelle …"
                  maxLength={RECIPE_LIMITS.descriptionMax}
                  rows={2}
                  aria-invalid={!!errorOf("description") || undefined}
                  aria-describedby={errorOf("description") ? `${ids.description}-error` : undefined}
                />
              </Field>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                  <span className="text-body-sm font-medium text-foreground">Portionen</span>
                  <QuantityStepper
                    label="Portionen"
                    value={servings}
                    onValueChange={setServings}
                    min={1}
                    max={RECIPE_LIMITS.servings.max}
                    step={1}
                    format={(v) => formatNumber(v)}
                  />
                  {errorOf("servings") && (
                    <p className="text-body-sm text-destructive">{errorOf("servings")}</p>
                  )}
                </div>

                <Field
                  id={ids.weight}
                  label="Gewicht nach dem Kochen"
                  optional
                  className="sm:w-56"
                  error={
                    errorOf("totalWeightG") ??
                    (weightTooLow && nutrition ? tooLowMessage(nutrition) : undefined)
                  }
                  hint={
                    nutrition && nutrition.rawWeightG > 0
                      ? `Rohgewicht der Zutaten: ${formatGrams(nutrition.rawWeightG)}`
                      : "Macht Portionen in Gramm genauer."
                  }
                >
                  <NumberInput
                    id={ids.weight}
                    value={totalWeightG}
                    onValueChange={(v) => setTotalWeightG(v != null && v > 0 ? v : null)}
                    min={0}
                    max={RECIPE_LIMITS.totalWeightG.max}
                    step={10}
                    decimals={0}
                    unit="g"
                    placeholder="optional"
                    aria-invalid={!!errorOf("totalWeightG") || weightTooLow || undefined}
                    aria-describedby={`${ids.weight}-hint ${ids.weight}-error`}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Ingredients */}
          <Card>
            <CardHeader>
              <CardTitle id={ids.ingredients}>
                Zutaten
                {ingredients.length > 0 && (
                  <span className="ml-2 text-body-sm font-medium text-muted-foreground tabular">
                    {ingredients.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {ingredients.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<UtensilsCrossed />}
                  title="Noch keine Zutaten"
                  description="Füge die Zutaten mit ihrer Menge hinzu, die Nährwerte rechnen wir live mit."
                />
              ) : (
                <ul aria-labelledby={ids.ingredients} className="-mx-2 flex flex-col divide-y divide-border">
                  {ingredients.map((ing, idx) => {
                    const err =
                      errorOf(`ingredients.${idx}.foodId`) ?? errorOf(`ingredients.${idx}.servingId`);
                    return (
                      <li key={ing.key} className="flex items-center gap-1 py-1">
                        <button
                          type="button"
                          onClick={() => openEdit(ing.key)}
                          className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left focus-ring transition-colors duration-150 hover:bg-accent"
                          aria-label={`${ing.food.name}, ${draftAmountLabel(ing)} bearbeiten`}
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-body font-medium text-foreground">
                              {ing.food.name}
                            </span>
                            <span className="truncate text-body-sm text-muted-foreground tabular">
                              {draftAmountLabel(ing)}
                            </span>
                            {err && <span className="text-body-sm text-destructive">{err}</span>}
                          </span>
                          <span className="shrink-0 text-body-sm font-semibold text-foreground tabular">
                            {formatKcal(draftKcal(ing))}
                          </span>
                          <Pencil aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(ing.key)}
                          aria-label={`${ing.food.name} entfernen`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {ingredientError && (
                <p role="alert" className="text-body-sm text-destructive">
                  {ingredientError}
                </p>
              )}
              <Button
                type="button"
                variant="soft"
                block
                onClick={openAdd}
                disabled={ingredients.length >= RECIPE_LIMITS.ingredientsMax}
              >
                <Plus aria-hidden="true" />
                Zutat hinzufügen
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live nutrition + save (sticky on desktop) */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card aria-live="polite">
            <CardHeader>
              <CardTitle>Nährwerte</CardTitle>
            </CardHeader>
            <CardContent>
              {nutrition && ingredients.length > 0 ? (
                <RecipeNutritionSummary nutrition={nutrition} servings={servings} variant="live" />
              ) : (
                <p className="text-body-sm text-muted-foreground">
                  Sobald du Zutaten hinzufügst, siehst du hier Kalorien und Makros pro Portion.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-gutter flex flex-col gap-2 border-t border-border bg-background/95 px-gutter pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <Button
              type="submit"
              size="lg"
              block
              loading={isPending}
              disabled={ingredients.length === 0 || weightTooLow}
            >
              Speichern
            </Button>
            {ingredients.length === 0 && (
              <p className="text-center text-caption text-muted-foreground">
                Füge mindestens eine Zutat hinzu, um zu speichern.
              </p>
            )}
          </div>
        </div>
      </form>

      <IngredientPicker
        open={pickerOpen}
        onOpenChange={(o) => {
          setPickerOpen(o);
          if (!o) setEditingKey(null);
        }}
        initial={
          editing ? { food: editing.food, servingId: editing.servingId, quantity: editing.quantity } : null
        }
        excludeFoodId={initial?.foodId ?? null}
        onConfirm={onPicked}
      />
    </>
  );
}

function tooLowMessage(n: RecipeAggregate) {
  const min = formatGrams(Math.ceil(n.minTotalWeightG));
  return n.hasCookedWeight
    ? `Zu niedrig für diese Zutaten, mindestens ${min}.`
    : `Bitte gib das Gewicht nach dem Kochen an (mindestens ${min}).`;
}

function Field({
  id,
  label,
  optional,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-body-sm font-medium text-foreground">
        {label}
        {optional && <span className="text-caption font-normal text-muted-foreground">optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-body-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
