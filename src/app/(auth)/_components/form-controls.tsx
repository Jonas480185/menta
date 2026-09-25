"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClass, type ButtonVariant } from "./button-styles";

export { buttonClass };

/*
 * Minimal, accessible form primitives for the auth + account screens.
 * Styled with semantic tokens only; meant to be swapped for src/components/ui once the
 * component library lands.
 */

const inputClass = cn(
  "h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground",
  "placeholder:text-muted-foreground outline-none transition-[border-color,box-shadow] duration-150",
  "focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25",
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/25",
  "disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
);

interface FieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Optional element rendered at the right of the label row (e.g. a link). */
  labelAside?: ReactNode;
}

function FieldShell({
  id,
  label,
  error,
  hint,
  labelAside,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  labelAside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({ label, error, hint, labelAside, className, ref, ...props }: FieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} labelAside={labelAside}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(inputClass, className)}
        {...props}
      />
    </FieldShell>
  );
}

export function PasswordField({
  label,
  error,
  hint,
  labelAside,
  className,
  ref,
  ...props
}: Omit<FieldProps, "type">) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} labelAside={labelAside}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(inputClass, "pr-12", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
          aria-pressed={visible}
          aria-controls={id}
          className={cn(
            "absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-xl",
            "text-muted-foreground transition-colors duration-150 hover:text-foreground",
            "outline-none focus-visible:ring-4 focus-visible:ring-ring/25 motion-reduce:transition-none",
          )}
        >
          {visible ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
        </button>
      </div>
    </FieldShell>
  );
}

interface SubmitButtonProps extends ComponentProps<"button"> {
  pending?: boolean;
  pendingLabel?: string;
  variant?: ButtonVariant;
}

/** Submit button with a loading state; keeps its width stable while pending. */
export function SubmitButton({
  pending = false,
  pendingLabel,
  variant = "primary",
  className,
  children,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={buttonClass(variant, cn("h-12", className))}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 aria-hidden className="size-5 motion-safe:animate-spin" />
          <span>{pendingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Form-level message (error or success), announced to screen readers. */
export function FormMessage({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  if (!children) return null;
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-success/30 bg-success/10 text-foreground",
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone === "success" && "text-success")} />
      <div>{children}</div>
    </div>
  );
}
