"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { formatNumber } from "@/lib/format";

import { formatServings, stepValue } from "./number-utils";
import { focusRing } from "./tokens";

export interface QuantityStepperProps extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Default 0. */
  min?: number;
  max?: number;
  /** Default 1. Use 0.25 / 0.5 for servings: values render as ¼ ½ ¾. */
  step?: number;
  /** Accessible name of the value, e.g. "Portionen". Required. */
  label: string;
  /** Unit shown under the value (e.g. "Portionen", "Stück"). */
  unit?: string;
  /** Custom display formatter; defaults to fraction glyphs for fractional steps. */
  format?: (value: number) => string;
  size?: "md" | "lg";
  disabled?: boolean;
}

const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 90;

/**
 * − value + control for servings and counts. Tap = one step, press-and-hold repeats,
 * keyboard: the value is a `spinbutton` (↑/↓, Home/End, PageUp/PageDown = ×5).
 */
function QuantityStepper({
  value: valueProp,
  defaultValue,
  onValueChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  label,
  unit,
  format,
  size = "md",
  disabled = false,
  className,
  ...props
}: QuantityStepperProps) {
  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? min);
  const value = isControlled ? valueProp : internal;

  const display =
    format ?? (step < 1 ? formatServings : (v: number) => formatNumber(v, { maxFractionDigits: 2 }));
  const text = display(value);
  const valueText = unit ? `${text} ${unit}` : text;

  const emit = (next: number) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  // Long-press repeat. The running value lives in a ref so repeated ticks don't depend
  // on a re-render of the (possibly controlled) parent.
  const running = useRef<{ current: number; timer: ReturnType<typeof setTimeout> | undefined }>({
    current: value,
    timer: undefined,
  });

  const stop = () => {
    clearTimeout(running.current.timer);
    running.current.timer = undefined;
  };

  useEffect(() => stop, []);

  const tick = (direction: 1 | -1): boolean => {
    const next = stepValue(running.current.current, direction, { step, min, max });
    if (next === running.current.current) return false;
    running.current.current = next;
    emit(next);
    return true;
  };

  const startPress = (event: React.PointerEvent<HTMLButtonElement>, direction: 1 | -1) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    stop();
    running.current.current = value;
    if (!tick(direction)) return;
    const repeat = () => {
      if (!tick(direction)) return stop();
      running.current.timer = setTimeout(repeat, REPEAT_INTERVAL);
    };
    running.current.timer = setTimeout(repeat, REPEAT_DELAY);
  };

  const keyboardClick = (event: React.MouseEvent<HTMLButtonElement>, direction: 1 | -1) => {
    // Pointer presses are handled in onPointerDown; `detail === 0` means Enter/Space.
    if (event.detail !== 0) return;
    running.current.current = value;
    tick(direction);
  };

  const onSpinKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let next: number | undefined;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
        next = stepValue(value, 1, { step, min, max });
        break;
      case "ArrowDown":
      case "ArrowLeft":
        next = stepValue(value, -1, { step, min, max });
        break;
      case "PageUp":
        next = Math.min(max, stepValue(value, 1, { step: step * 5, min, max }));
        break;
      case "PageDown":
        next = Math.max(min, stepValue(value, -1, { step: step * 5, min, max }));
        break;
      case "Home":
        next = min;
        break;
      case "End":
        if (Number.isFinite(max)) next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next !== undefined && next !== value) emit(next);
  };

  const buttonClasses = cn(
    "inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-secondary text-secondary-foreground select-none",
    "transition-[background-color,scale] duration-150 hover:bg-accent active:scale-[0.94] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-40",
    size === "md" ? "size-11 [&_svg]:size-5" : "size-13 [&_svg]:size-6",
    focusRing,
  );

  return (
    <div
      role="group"
      aria-label={label}
      data-slot="quantity-stepper"
      data-disabled={disabled || undefined}
      className={cn("inline-flex items-center gap-2", disabled && "opacity-50", className)}
      {...props}
    >
      <button
        type="button"
        aria-label={`${label} verringern`}
        disabled={disabled || value <= min}
        onPointerDown={(event) => startPress(event, -1)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={(event) => keyboardClick(event, -1)}
        onContextMenu={(event) => event.preventDefault()}
        className={buttonClasses}
      >
        <Minus aria-hidden="true" strokeWidth={2.5} />
      </button>
      <div
        role="spinbutton"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuetext={valueText}
        aria-disabled={disabled || undefined}
        onKeyDown={onSpinKey}
        className={cn(
          "flex min-w-16 cursor-default flex-col items-center justify-center rounded-md px-1 leading-none",
          focusRing,
        )}
      >
        <span className={cn("numeric text-foreground", size === "md" ? "text-stat-sm" : "text-stat")}>
          {text}
        </span>
        {unit && <span className="mt-1 text-caption text-muted-foreground">{unit}</span>}
      </div>
      <button
        type="button"
        aria-label={`${label} erhöhen`}
        disabled={disabled || value >= max}
        onPointerDown={(event) => startPress(event, 1)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={(event) => keyboardClick(event, 1)}
        onContextMenu={(event) => event.preventDefault()}
        className={buttonClasses}
      >
        <Plus aria-hidden="true" strokeWidth={2.5} />
      </button>
      <span className="sr-only" aria-live="polite">
        {valueText}
      </span>
    </div>
  );
}

export { QuantityStepper };
