"use client";

import { useId, useState, useTransition } from "react";

import { AdaptiveSheet } from "@/components/ui/adaptive-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { toast } from "@/components/ui/sonner";
import { formatNumber } from "@/lib/format";
import type { ActionResult } from "@/lib/result";
import { NETWORK_ERROR } from "@/lib/use-action";

export interface ValueSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label: string;
  unit: string;
  /** Prefilled value (null = empty field). */
  initialValue: number | null;
  min: number;
  max: number;
  step?: number;
  submitLabel: string;
  /** Server action call; the sheet closes on success, field errors are shown inline. */
  onSubmit: (value: number) => Promise<ActionResult<unknown>>;
  /** Called after a successful submit (e.g. success toast). */
  onSuccess?: (value: number) => void;
  /** Extra content below the field (hints, presets). */
  children?: React.ReactNode;
}

/** Small sheet with one number field: custom water amount, steps, goals. */
export function ValueSheet({
  open,
  onOpenChange,
  title,
  description,
  label,
  unit,
  initialValue,
  min,
  max,
  step = 1,
  submitLabel,
  onSubmit,
  onSuccess,
  children,
}: ValueSheetProps) {
  const id = useId();
  const [value, setValue] = useState<number | null>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setValue(initialValue);
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (value == null || !Number.isFinite(value)) {
      setError("Bitte einen Wert eingeben.");
      return;
    }
    if (value < min || value > max) {
      setError(`Bitte einen Wert zwischen ${formatNumber(min)} und ${formatNumber(max)} eingeben.`);
      return;
    }
    const submitted = Math.round(value);
    startTransition(async () => {
      let result: ActionResult<unknown>;
      try {
        result = await onSubmit(submitted);
      } catch {
        result = { ok: false, error: NETWORK_ERROR };
      }
      if (!result.ok) {
        const fieldError = Object.values(result.error.fieldErrors ?? {})[0]?.[0];
        setError(fieldError ?? result.error.message);
        if (!fieldError) toast.error(result.error.message);
        return;
      }
      onOpenChange(false);
      onSuccess?.(submitted);
    });
  };

  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      footer={
        <Button type="submit" form={`${id}-form`} block loading={isPending}>
          {submitLabel}
        </Button>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <Label htmlFor={`${id}-input`}>{label}</Label>
        <NumberInput
          id={`${id}-input`}
          value={value}
          onValueChange={(v) => {
            setValue(v);
            setError(null);
          }}
          min={min}
          max={max}
          step={step}
          decimals={0}
          unit={unit}
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="text-body-sm text-destructive">
            {error}
          </p>
        )}
        {children}
      </form>
    </AdaptiveSheet>
  );
}
