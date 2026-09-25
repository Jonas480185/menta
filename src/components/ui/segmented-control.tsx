"use client";

import { LayoutGroup, motion } from "motion/react";
import { useCallback, useId, useRef, useState } from "react";

import { spring } from "@/components/theme/tokens";
import { cn } from "@/lib/utils";

import { focusRing } from "./tokens";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Accessible name when `label` is an icon or abbreviation (e.g. "7 Tage" for "7T"). */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> extends Omit<
  React.ComponentProps<"div">,
  "onChange" | "defaultValue"
> {
  options: readonly SegmentedControlOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  /** Required: describes what is being chosen, e.g. "Zeitraum". */
  "aria-label": string;
  size?: "sm" | "md";
  /** Stretch to the full width with equal segments. */
  block?: boolean;
}

/**
 * Single-choice pill switcher with an animated thumb (period filters 7T/30T/3M/6M/1J,
 * macro modes g/%). Semantics: `radiogroup`; ←/→/↑/↓ move and select, Home/End jump.
 */
function SegmentedControl<T extends string = string>({
  options,
  value: valueProp,
  defaultValue,
  onValueChange,
  size = "md",
  block = false,
  className,
  ...props
}: SegmentedControlProps<T>) {
  const layoutId = useId();
  const [uncontrolled, setUncontrolled] = useState<T | undefined>(defaultValue ?? options[0]?.value);
  const value = valueProp !== undefined ? valueProp : uncontrolled;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = useCallback(
    (next: T) => {
      if (valueProp === undefined) setUncontrolled(next);
      if (next !== value) onValueChange?.(next);
    },
    [onValueChange, value, valueProp],
  );

  const enabledIndexes = options.flatMap((o, i) => (o.disabled ? [] : [i]));
  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabStopIndex =
    selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : enabledIndexes[0];

  const moveTo = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    refs.current[index]?.focus();
    select(option.value);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (enabledIndexes.length === 0) return;
    const pos = enabledIndexes.indexOf(index);
    let target: number | undefined;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        target = enabledIndexes[(pos + 1) % enabledIndexes.length];
        break;
      case "ArrowLeft":
      case "ArrowUp":
        target = enabledIndexes[(pos - 1 + enabledIndexes.length) % enabledIndexes.length];
        break;
      case "Home":
        target = enabledIndexes[0];
        break;
      case "End":
        target = enabledIndexes[enabledIndexes.length - 1];
        break;
      default:
        return;
    }
    event.preventDefault();
    if (target !== undefined) moveTo(target);
  };

  return (
    <LayoutGroup id={layoutId}>
      <div
        role="radiogroup"
        data-slot="segmented-control"
        className={cn(
          "relative inline-flex items-center gap-0.5 rounded-lg bg-surface-inset p-1",
          size === "md" ? "h-11" : "h-9",
          block && "flex w-full",
          className,
        )}
        {...props}
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.ariaLabel}
              disabled={option.disabled}
              tabIndex={index === tabStopIndex ? 0 : -1}
              data-state={selected ? "on" : "off"}
              onClick={() => select(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "relative isolate inline-flex h-full min-w-11 cursor-pointer items-center justify-center rounded-md px-3.5 font-medium whitespace-nowrap tabular",
                "text-muted-foreground transition-colors duration-150 hover:text-foreground",
                "disabled:cursor-not-allowed disabled:opacity-40 data-[state=on]:text-foreground",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                size === "md" ? "text-body-sm" : "text-caption",
                block && "flex-1",
                focusRing,
              )}
            >
              {selected && (
                <motion.span
                  layoutId="segmented-thumb"
                  aria-hidden="true"
                  transition={spring.snappy}
                  className="absolute inset-0 -z-10 rounded-md bg-card shadow-sm dark:bg-surface-3"
                />
              )}
              {option.label}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export { SegmentedControl };
