"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";

import { logWeightAction } from "@/app/(app)/progress/weight/actions";
import { AdaptiveSheet } from "@/components/ui/adaptive-sheet";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import {
  WEIGHT_JUMP_HINT_KG,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
  WEIGHT_NOTE_MAX,
  weightEntryInputSchema,
} from "@/domain/weight";
import type { IsoDate } from "@/lib/dates";
import type { FieldErrors } from "@/lib/errors";
import { formatRelativeDay, formatWeightKg } from "@/lib/format";
import { useAction } from "@/lib/use-action";

/** Minimal entry shape the sheet can edit (e.g. a WeightEntry from the service). */
export interface EditableWeightEntry {
  date: IsoDate;
  weightKg: number;
  bodyFatPct?: number | null;
  note?: string | null;
}

export interface LogWeightFormProps {
  /** The user's today (their timezone): default date and upper bound. */
  today: IsoDate;
  /** Prefill for new entries (usually the latest logged weight). */
  lastWeightKg?: number | null;
  /** Edit an existing entry instead of logging a new one. */
  entry?: EditableWeightEntry | null;
  /** Weight per day already logged: shows a "replaces" hint when the chosen day has one. */
  existing?: Readonly<Record<IsoDate, number>>;
  onSaved?: () => void;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function issuesToFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) (out[issue.path.map(String).join(".") || "_"] ??= []).push(issue.message);
  return out;
}

/** The form inside LogWeightSheet: exported for embedding and tests. */
export function LogWeightForm({ today, lastWeightKg, entry, existing, onSaved }: LogWeightFormProps) {
  const id = useId();
  const [date, setDate] = useState<IsoDate>(entry?.date ?? today);
  const [weightKg, setWeightKg] = useState<number | null>(entry?.weightKg ?? lastWeightKg ?? null);
  const [bodyFatPct, setBodyFatPct] = useState<number | null>(entry?.bodyFatPct ?? null);
  const [note, setNote] = useState(entry?.note ?? "");
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const {
    execute,
    isPending,
    fieldErrors: serverErrors,
  } = useAction(logWeightAction, {
    successMessage: ({ entry: saved }) => `Gewicht eingetragen: ${formatWeightKg(saved.weightKg)}.`,
    onSuccess: () => onSaved?.(),
  });
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };

  const replacing = !entry && existing?.[date] !== undefined ? existing[date] : null;
  const reference = entry && date === entry.date ? null : (lastWeightKg ?? null);
  const jump =
    weightKg !== null && reference !== null && Math.abs(weightKg - reference) > WEIGHT_JUMP_HINT_KG;

  const step = (delta: number) => {
    const base = weightKg ?? lastWeightKg ?? 70;
    setWeightKg(Math.min(WEIGHT_MAX_KG, Math.max(WEIGHT_MIN_KG, round1(base + delta))));
    setClientErrors((e) => ({ ...e, weightKg: [] }));
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = weightEntryInputSchema.safeParse({ date, weightKg, bodyFatPct, note });
    const next: FieldErrors = parsed.success ? {} : issuesToFieldErrors(parsed.error.issues);
    if (date > today) next.date = ["Das Datum liegt in der Zukunft."];
    setClientErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) return;
    void execute(parsed.data);
  };

  const errorOf = (field: string) => errors[field]?.[0];
  const weightError = errorOf("weightKg");
  const dateError = errorOf("date");
  const fatError = errorOf("bodyFatPct");
  const noteError = errorOf("note");

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={isPending}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-weight`}>Gewicht</Label>
        <div className="flex items-center gap-2">
          <IconButton
            type="button"
            label="0,1 kg weniger"
            variant="secondary"
            onClick={() => step(-0.1)}
            disabled={isPending}
          >
            <Minus />
          </IconButton>
          <NumberInput
            id={`${id}-weight`}
            value={weightKg}
            onValueChange={(v) => {
              setWeightKg(v);
              if (clientErrors.weightKg?.length) setClientErrors((e) => ({ ...e, weightKg: [] }));
            }}
            step={0.1}
            decimals={2}
            unit="kg"
            placeholder="z. B. 72,5"
            autoFocus={!entry}
            aria-invalid={weightError ? true : undefined}
            aria-describedby={weightError ? `${id}-weight-error` : jump ? `${id}-weight-hint` : undefined}
            className="text-center text-headline tabular"
            wrapperClassName="flex-1"
          />
          <IconButton
            type="button"
            label="0,1 kg mehr"
            variant="secondary"
            onClick={() => step(0.1)}
            disabled={isPending}
          >
            <Plus />
          </IconButton>
        </div>
        {weightError ? (
          <p id={`${id}-weight-error`} role="alert" className="text-body-sm text-destructive">
            {weightError}
          </p>
        ) : jump && reference !== null ? (
          <p id={`${id}-weight-hint`} className="text-body-sm text-muted-foreground">
            Großer Sprung zum letzten Eintrag ({formatWeightKg(reference)}). Tippfehler? Tageswerte schwanken
            um 1 bis 2 kg, das ist normal.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-date`}>Datum</Label>
        <Input
          id={`${id}-date`}
          type="date"
          value={date}
          max={today}
          required
          disabled={!!entry}
          onChange={(e) => {
            setDate(e.target.value);
            setClientErrors((prev) => ({ ...prev, date: [] }));
          }}
          aria-invalid={dateError ? true : undefined}
          aria-describedby={
            dateError ? `${id}-date-error` : replacing !== null ? `${id}-date-hint` : undefined
          }
          className="tabular"
        />
        {dateError ? (
          <p id={`${id}-date-error`} role="alert" className="text-body-sm text-destructive">
            {dateError}
          </p>
        ) : replacing !== null ? (
          <p id={`${id}-date-hint`} className="text-body-sm text-muted-foreground">
            Für diesen Tag ist schon {formatWeightKg(replacing)} eingetragen. Speichern ersetzt den Wert.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-fat`}>
          Körperfett <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <NumberInput
          id={`${id}-fat`}
          value={bodyFatPct}
          onValueChange={setBodyFatPct}
          step={0.1}
          decimals={1}
          unit="%"
          aria-invalid={fatError ? true : undefined}
          aria-describedby={fatError ? `${id}-fat-error` : undefined}
        />
        {fatError && (
          <p id={`${id}-fat-error`} role="alert" className="text-body-sm text-destructive">
            {fatError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-note`}>
          Notiz <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          maxLength={WEIGHT_NOTE_MAX}
          rows={2}
          placeholder="z. B. nach dem Urlaub"
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={noteError ? true : undefined}
        />
        {noteError && (
          <p role="alert" className="text-body-sm text-destructive">
            {noteError}
          </p>
        )}
      </div>

      <Button type="submit" block size="lg" loading={isPending}>
        {replacing !== null ? "Ersetzen" : "Speichern"}
      </Button>
    </form>
  );
}

export interface LogWeightSheetProps extends Omit<LogWeightFormProps, "onSaved"> {
  /** Element that opens the sheet. Omit when controlling `open`. */
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: () => void;
}

/**
 * "Gewicht eintragen": bottom sheet on phones, dialog on desktop. Logs (or edits) one day's
 * weight via the logWeightAction server action; the form resets every time it opens.
 */
export function LogWeightSheet({
  trigger,
  open: openProp,
  onOpenChange,
  onSaved,
  ...formProps
}: LogWeightSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <AdaptiveSheet
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title={formProps.entry ? "Eintrag bearbeiten" : "Gewicht eintragen"}
      description={
        formProps.entry
          ? formatRelativeDay(formProps.entry.date, formProps.today)
          : "Am besten morgens, zur gleichen Uhrzeit."
      }
    >
      {open && (
        <LogWeightForm
          {...formProps}
          onSaved={() => {
            setOpen(false);
            onSaved?.();
          }}
        />
      )}
    </AdaptiveSheet>
  );
}
