"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

import { fieldClasses } from "./tokens";

/** Wrapper variant used when the field has adornments (icon / unit suffix). */
const wrapperClasses = [
  "flex h-11 w-full min-w-0 cursor-text items-center gap-2 rounded-md border border-input bg-background px-3.5 text-base shadow-xs shadow-foreground/5",
  "transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none",
  "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
  "has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:focus-within:ring-destructive/25",
  "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
].join(" ");

export interface InputProps extends React.ComponentProps<"input"> {
  /** Decorative icon at the start (e.g. `<Search />`). */
  leadingIcon?: React.ReactNode;
  /** Unit or trailing content, e.g. "g", "kcal". Announced via `aria-describedby`. */
  suffix?: React.ReactNode;
  /** Classes for the adornment wrapper (only rendered with `leadingIcon` / `suffix`). */
  wrapperClassName?: string;
}

function Input({ className, type = "text", leadingIcon, suffix, wrapperClassName, ...props }: InputProps) {
  const suffixId = useId();

  if (leadingIcon == null && suffix == null) {
    return <input data-slot="input" type={type} className={cn(fieldClasses, "h-11 px-3.5", className)} {...props} />;
  }

  const describedBy = [props["aria-describedby"], suffix != null ? suffixId : undefined].filter(Boolean).join(" ");

  return (
    <div
      data-slot="input-wrapper"
      className={cn(wrapperClasses, wrapperClassName)}
      onMouseDown={(event) => {
        // Clicking the padding / icon / unit focuses the field instead of doing nothing.
        const input = event.currentTarget.querySelector("input");
        if (input && event.target !== input) {
          event.preventDefault();
          input.focus();
        }
      }}
    >
      {leadingIcon != null && (
        <span
          aria-hidden="true"
          className="flex shrink-0 text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5"
        >
          {leadingIcon}
        </span>
      )}
      <input
        data-slot="input"
        type={type}
        className={cn(
          "h-full w-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
          className,
        )}
        {...props}
        aria-describedby={describedBy || undefined}
      />
      {suffix != null && (
        <span id={suffixId} className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums select-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

export { Input };
