"use client";

import { useState } from "react";

import { parseDecimalInput } from "@/lib/format";

import { Input, type InputProps } from "./input";
import { formatDraft, roundToPrecision, stepPrecision, stepValue } from "./number-utils";

export interface NumberInputProps extends Omit<
  InputProps,
  "value" | "defaultValue" | "onChange" | "type" | "min" | "max" | "step" | "suffix" | "inputMode"
> {
  value?: number | null;
  defaultValue?: number | null;
  /** Called with the parsed number while typing (`null` when empty) and with the clamped value on blur. */
  onValueChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Step for ↑/↓ keys (default 1). */
  step?: number;
  /** Maximum fraction digits kept on blur (default: precision of `step`, at least 1 when step < 1). */
  decimals?: number;
  /** Unit shown inside the field, e.g. "g", "kcal", "kg". */
  unit?: React.ReactNode;
}

/**
 * Numeric text field for German users: accepts "1,5" as well as "1.5" (parsed by
 * `parseDecimalInput` from `@/lib/format`), shows the
 * numeric keypad on mobile (`inputMode="decimal"`), clamps to min/max on blur, supports
 * ↑/↓ stepping and an inline unit suffix. Works controlled, uncontrolled and with
 * react-hook-form (`value` / `onValueChange` / `onBlur` / `ref`).
 */
function NumberInput({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  min,
  max,
  step = 1,
  decimals: decimalsProp,
  unit,
  onBlur,
  onKeyDown,
  placeholder,
  ...props
}: NumberInputProps) {
  const decimals = decimalsProp ?? stepPrecision(step);
  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = useState<number | null>(defaultValue);
  const value = isControlled ? (valueProp ?? null) : internal;
  const [draft, setDraft] = useState(() => formatDraft(value, decimals));

  // Sync external changes (reset, programmatic updates) without clobbering what the user is typing.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== parseDecimalInput(draft)) setDraft(formatDraft(value, decimals));
  }

  const allowNegative = min === undefined || min < 0;

  const emit = (next: number | null) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  const clampValue = (n: number) => {
    let v = roundToPrecision(n, decimals);
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  return (
    <Input
      type="text"
      inputMode={decimals === 0 && !allowNegative ? "numeric" : "decimal"}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="done"
      placeholder={placeholder}
      suffix={unit}
      className="tabular"
      {...props}
      value={draft}
      onChange={(event) => {
        const pattern = allowNegative ? /[^\d.,\-]/g : /[^\d.,]/g;
        let next = event.target.value.replace(pattern, "");
        if (allowNegative) next = next.replace(/(?!^)-/g, "");
        setDraft(next);
        if (next.trim() === "") {
          if (value !== null) emit(null);
          return;
        }
        const parsed = parseDecimalInput(next);
        if (parsed !== null && parsed !== value) emit(parsed);
      }}
      onBlur={(event) => {
        const parsed = parseDecimalInput(draft);
        if (parsed === null) {
          setDraft("");
          if (value !== null) emit(null);
        } else {
          const clamped = clampValue(parsed);
          setDraft(formatDraft(clamped, decimals));
          if (clamped !== value) emit(clamped);
        }
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const current = parseDecimalInput(draft) ?? value ?? min ?? 0;
        const next = stepValue(current, event.key === "ArrowUp" ? 1 : -1, { step, min, max });
        setDraft(formatDraft(next, decimals));
        if (next !== value) emit(next);
      }}
    />
  );
}

/**
 * Adapter for react-hook-form: `<NumberInput {...numberFieldProps(field)} />`.
 * Maps RHF's `onChange` to `onValueChange` and keeps `ref`/`onBlur`/`name`.
 */
function numberFieldProps(field: {
  value: unknown;
  onChange: (value: number | null) => void;
  onBlur: () => void;
  name: string;
  ref: React.Ref<HTMLInputElement>;
  disabled?: boolean;
}) {
  return {
    value: typeof field.value === "number" ? field.value : null,
    onValueChange: field.onChange,
    onBlur: field.onBlur,
    name: field.name,
    ref: field.ref,
    disabled: field.disabled,
  };
}

export { NumberInput, numberFieldProps };
