import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const sizes = { sm: "size-4", md: "size-5", lg: "size-8" } as const;

export interface SpinnerProps extends Omit<React.ComponentProps<"svg">, "children"> {
  size?: keyof typeof sizes;
  /** Accessible text. Pass `aria-hidden` instead when the parent already announces loading. */
  label?: string;
}

/**
 * Indeterminate loading indicator (the only kind of looping motion allowed).
 */
function Spinner({ size = "md", label = "Wird geladen", className, ...props }: SpinnerProps) {
  const hidden = props["aria-hidden"] === true || props["aria-hidden"] === "true";
  return (
    <LoaderCircle
      data-slot="spinner"
      role={hidden ? undefined : "status"}
      aria-label={hidden ? undefined : label}
      className={cn("animate-spin text-current", sizes[size], className)}
      {...props}
    />
  );
}

export { Spinner };
