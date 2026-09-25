import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

import { Spinner } from "./spinner";
import { focusRing, touchTarget } from "./tokens";

const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none",
    "transition-[background-color,color,box-shadow,transform,opacity] duration-150 ease-out",
    "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    focusRing,
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary/90 dark:shadow-none",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        soft: "bg-primary/15 text-foreground hover:bg-primary/25",
        outline: "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "h-auto rounded-sm px-0 text-foreground underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: cn("h-9 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4", touchTarget),
        md: "h-11 px-5 text-base",
        lg: "h-13 px-7 text-base",
        "icon-sm": cn("size-9 [&_svg:not([class*='size-'])]:size-4", touchTarget),
        icon: "size-11",
        "icon-lg": "size-13 [&_svg:not([class*='size-'])]:size-6",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends React.ComponentProps<"button">, ButtonVariantProps {
  /** Render the single child element (e.g. `<Link>`) with button styles instead of a `<button>`. */
  asChild?: boolean;
  /**
   * Shows a spinner, disables the button and sets `aria-busy`. The label stays in the DOM
   * (transparent) so the width never jumps. Ignored with `asChild`.
   */
  loading?: boolean;
}

function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  type,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, block }), className);

  if (asChild) {
    return (
      <Slot data-slot="button" className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      data-slot="button"
      data-variant={variant ?? "primary"}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <Spinner aria-hidden="true" size={size === "sm" || size === "icon-sm" ? "sm" : "md"} />
          </span>
          <span className="inline-flex items-center gap-[inherit] opacity-0">{children}</span>
          <span className="sr-only">Wird geladen</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { Button, buttonVariants };
