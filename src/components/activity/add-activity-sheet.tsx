"use client";

import { ChevronLeft, Dumbbell, Info, Plus, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { addActivityAction } from "@/app/(app)/activity/actions";
import { AdaptiveSheet } from "@/components/ui/adaptive-sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { focusRing } from "@/components/ui/tokens";
import {
  ACTIVITY_LIMITS,
  estimateActivityKcal,
  searchMetActivities,
  type ActivityType,
  type MetActivity,
} from "@/domain/activity";
import type { IsoDate } from "@/lib/dates";
import type { FieldErrors } from "@/lib/errors";
import { formatKcal, formatNumber } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/server/services/activity";

const TYPE_LABEL: Record<Exclude<ActivityType, "steps">, string> = {
  cardio: "Ausdauer",
  strength: "Kraft",
  sport: "Sport",
  other: "Sonstiges",
};

type Selection = { kind: "met"; met: MetActivity } | { kind: "custom" };

export interface AddActivitySheetProps {
  date: IsoDate;
  /** Weight used for the live kcal estimate (see getActivitySummary().weightKg). */
  weightKg: number;
  weightIsFallback: boolean;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAdded?: (entry: ActivityEntry) => void;
}

/**
 * "Aktivität hinzufügen": searchable MET picker (or a custom activity) → duration, an
 * editable auto kcal estimate and an optional note. Adds via addActivityAction.
 */
export function AddActivitySheet({
  date,
  weightKg,
  weightIsFallback,
  trigger,
  open: openProp,
  onOpenChange,
  onAdded,
}: AddActivitySheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const [selection, setSelection] = useState<Selection | null>(null);

  const setOpen = (next: boolean) => {
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
    if (!next) setSelection(null);
  };

  return (
    <AdaptiveSheet
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title={selection ? (selection.kind === "met" ? selection.met.name : "Eigene Aktivität") : "Aktivität hinzufügen"}
      snapPoints={[0.85]}
    >
      {open &&
        (selection ? (
          <DetailStep
            date={date}
            weightKg={weightKg}
            weightIsFallback={weightIsFallback}
            selection={selection}
            onBack={() => setSelection(null)}
            onAdded={(entry) => {
              setOpen(false);
              onAdded?.(entry);
            }}
          />
        ) : (
          <PickStep onPick={setSelection} />
        ))}
    </AdaptiveSheet>
  );
}

function PickStep({ onPick }: { onPick: (selection: Selection) => void }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const resultsId = useId();
  const results = useMemo(() => searchMetActivities(query), [query]);

  return (
    <div className="flex flex-col gap-4 pb-2">
      <label htmlFor={inputId} className="sr-only">
        Aktivität suchen
      </label>
      <Input
        id={inputId}
        type="search"
        autoFocus
        autoComplete="off"
        enterKeyHint="search"
        placeholder="z. B. Laufen, Krafttraining …"
        leadingIcon={<Search aria-hidden="true" />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-controls={resultsId}
      />

      <Button type="button" variant="soft" block onClick={() => onPick({ kind: "custom" })}>
        <Plus aria-hidden="true" />
        Eigene Aktivität
      </Button>

      <div id={resultsId}>
        {results.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Search />}
            title={`Nichts gefunden für „${query}“`}
            description="Trage sie als eigene Aktivität mit selbst geschätzten Kalorien ein."
          />
        ) : (
          <ul className="-mx-2 flex flex-col" aria-label="Aktivitäten">
            {results.map((met) => (
              <li key={met.key}>
                <button
                  type="button"
                  onClick={() => onPick({ kind: "met", met })}
                  className={cn(
                    "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2.5 text-left transition-colors duration-150 hover:bg-accent active:bg-muted",
                    focusRing,
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-activity-soft text-activity-strong">
                    <Dumbbell className="size-5" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body font-medium text-foreground">{met.name}</span>
                    <span className="truncate text-body-sm text-muted-foreground">{TYPE_LABEL[met.type]}</span>
                  </span>
                  <span className="shrink-0 text-caption text-muted-foreground tabular">
                    {formatNumber(met.met, { maxFractionDigits: 1 })} MET
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

function DetailStep({
  date,
  weightKg,
  weightIsFallback,
  selection,
  onBack,
  onAdded,
}: {
  date: IsoDate;
  weightKg: number;
  weightIsFallback: boolean;
  selection: Selection;
  onBack: () => void;
  onAdded: (entry: ActivityEntry) => void;
}) {
  const id = useId();
  const isMet = selection.kind === "met";
  const [name, setName] = useState("");
  const [durationMin, setDurationMin] = useState<number | null>(30);
  const [kcalTouched, setKcalTouched] = useState(false);
  const estimate = isMet && durationMin != null ? estimateActivityKcal({ met: selection.met.met, weightKg, durationMin }) : null;
  const [caloriesBurned, setCaloriesBurned] = useState<number | null>(estimate !== null ? Math.round(estimate) : null);
  const [note, setNote] = useState("");
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const { execute, isPending, fieldErrors: serverErrors } = useAction(addActivityAction, {
    successMessage: (entry) => `${entry.name} hinzugefügt.`,
    onSuccess: (entry) => onAdded(entry),
  });
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };
  const errorOf = (field: string) => errors[field]?.[0];

  const setDuration = (value: number | null) => {
    setDurationMin(value);
    if (isMet && !kcalTouched && value != null) {
      setCaloriesBurned(Math.round(estimateActivityKcal({ met: selection.met.met, weightKg, durationMin: value })));
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: FieldErrors = {};
    if (isMet && durationMin == null) next.durationMin = ["Bitte eine Dauer angeben."];
    if (!isMet && !name.trim()) next.name = ["Bitte gib einen Namen ein."];
    if (!isMet && caloriesBurned == null) next.caloriesBurned = ["Bitte Kalorien angeben."];
    setClientErrors(next);
    if (Object.keys(next).length > 0 || durationMin == null) return;
    void execute({
      date,
      metKey: isMet ? selection.met.key : null,
      name: isMet ? null : name.trim(),
      durationMin,
      caloriesBurned: isMet && !kcalTouched ? null : caloriesBurned,
      note: note.trim() || null,
    });
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={isPending}>
      <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        Andere Aktivität
      </Button>

      {!isMet && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input
            id={`${id}-name`}
            value={name}
            maxLength={ACTIVITY_LIMITS.name.max}
            autoFocus
            placeholder="z. B. Klettern"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errorOf("name") ? true : undefined}
          />
          {errorOf("name") && (
            <p role="alert" className="text-body-sm text-destructive">
              {errorOf("name")}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-duration`}>Dauer</Label>
        <NumberInput
          id={`${id}-duration`}
          value={durationMin}
          onValueChange={setDuration}
          min={ACTIVITY_LIMITS.durationMin.min}
          max={ACTIVITY_LIMITS.durationMin.max}
          step={5}
          decimals={0}
          unit="min"
          autoFocus={isMet}
          aria-invalid={errorOf("durationMin") ? true : undefined}
        />
        {errorOf("durationMin") && (
          <p role="alert" className="text-body-sm text-destructive">
            {errorOf("durationMin")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-kcal`}>
          Kalorien {isMet && !kcalTouched && <span className="font-normal text-muted-foreground">(geschätzt)</span>}
        </Label>
        <NumberInput
          id={`${id}-kcal`}
          value={caloriesBurned}
          onValueChange={(v) => {
            setCaloriesBurned(v);
            setKcalTouched(true);
          }}
          min={ACTIVITY_LIMITS.caloriesBurned.min}
          max={ACTIVITY_LIMITS.caloriesBurned.max}
          step={10}
          decimals={0}
          unit="kcal"
          aria-invalid={errorOf("caloriesBurned") ? true : undefined}
        />
        {errorOf("caloriesBurned") ? (
          <p role="alert" className="text-body-sm text-destructive">
            {errorOf("caloriesBurned")}
          </p>
        ) : (
          isMet &&
          weightIsFallback && (
            <p className="flex items-start gap-1.5 text-body-sm text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Geschätzt mit {formatNumber(weightKg)} kg (kein Gewicht hinterlegt).
            </p>
          )
        )}
        {isMet && estimate !== null && (
          <p className="text-caption text-muted-foreground">Automatisch: {formatKcal(Math.round(estimate))}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-note`}>
          Notiz <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          maxLength={ACTIVITY_LIMITS.note.max}
          rows={2}
          placeholder="z. B. mit Anna"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <Button type="submit" block size="lg" loading={isPending}>
        Hinzufügen
      </Button>
    </form>
  );
}
