import { cn } from "@/lib/utils";

/** Button class names (server-safe: usable from server and client components). */
export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border border-border bg-card text-foreground hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
  ghost: "text-foreground hover:bg-muted",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cn(
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5",
    "text-base font-semibold transition-[opacity,background-color,transform] duration-150",
    "outline-none focus-visible:ring-4 focus-visible:ring-ring/35 active:scale-[0.99]",
    "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
    "motion-reduce:transition-none motion-reduce:active:scale-100",
    buttonVariants[variant],
    className,
  );
}
