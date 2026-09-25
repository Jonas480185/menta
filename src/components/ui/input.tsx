"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

import { fieldClasses } from "./tokens";

/** Wrapper look used when the field has adornments (icon / unit suffix). */
const wrapperClasses = [
  "flex w-full min-w-0 cursor-text items-center gap-2 rounded-control border px-3.5 text-body",
  "transition-[border-color,box-shadow] duration-150",
  "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25",
  "has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:focus-within:ring-destructive/25",
  "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
].join(" ");

const variantClasses = {
  /** Outlined field on cards and sheets (forms). */
  default: { plain: "h-11 px-3.5", wrapper: "h-11 border-input bg-card" },
  /** Borderless inset well, 48 px – the food search field. */
  inset: {
    plain: "h-12 border-transparent bg-surface-inset px-4",
    wrapper: "h-12 border-transparent bg-surface-inset px-4",
  },
} as const;

export interface InputProps extends React.ComponentProps<"input"> {
  /** Decorative icon at the start (e.g. `<Search />`). */
  leadingIcon?: React.ReactNode;
  /** Unit or trailing content, e.g. "g", "kcal". Announced via `aria-describedby`. */
  suffix?: React.ReactNode;
  /** `inset` = borderless 48 px well (search). Default `default`. */
  variant?: keyof typeof variantClasses;
  /** Classes for the adornment wrapper (only rendered with `leadingIcon` / `suffix`). */
  wrapperClassName?: string;
}

function Input({
  className,
  type = "text",
  leadingIcon,
  suffix,
  variant = "default",
  wrapperClassName,
  ...props
}: InputProps) {
  const suffixId = useId();
  const v = variantClasses[variant];

  if (leadingIcon == null && suffix == null) {
    return (
      <input data-slot="input" type={type} className={cn(fieldClasses, v.plain, className)} {...props} />
    );
  }

  const describedBy = [props["aria-describedby"], suffix != null ? suffixId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      data-slot="input-wrapper"
      className={cn(wrapperClasses, v.wrapper, wrapperClassName)}
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
          className="flex shrink-0 text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[18px]"
        >
          {leadingIcon}
        </span>
      )}
      <input
        data-slot="input"
        type={type}
        className={cn(
          "h-full w-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed",
          className,
        )}
        {...props}
        aria-describedby={describedBy || undefined}
      />
      {suffix != null && (
        <span
          id={suffixId}
          className="shrink-0 text-body-sm font-medium text-muted-foreground tabular select-none"
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

export { Input };
