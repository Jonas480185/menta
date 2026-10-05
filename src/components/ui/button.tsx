import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

import { Spinner } from "./spinner";
import { focusRing, touchTarget } from "./tokens";

const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 font-semibold whitespace-nowrap select-none",
    "transition-[background-color,color,box-shadow,scale,opacity] duration-150 ease-out",
    "active:scale-[0.98] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    focusRing,
  ].join(" "),
  {
    variants: {
      variant: {
        /** Mint fill with ink text: one per view. */
        primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        /** Mint-tinted, e.g. the "+" add buttons in meal cards. */
        soft: "bg-primary-soft text-primary-strong hover:bg-primary-soft/70",
        outline: "border border-border-strong bg-transparent text-foreground hover:bg-accent",
        ghost: "bg-transparent text-foreground hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "h-auto! rounded-xs px-0! text-primary-strong underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: cn("h-9 rounded-sm px-3.5 text-body-sm [&_svg:not([class*='size-'])]:size-4", touchTarget),
        md: "h-11 rounded-control px-5 text-body",
        lg: "h-13 rounded-control px-6 text-body",
        "icon-sm": cn("size-9 rounded-full [&_svg:not([class*='size-'])]:size-[18px]", touchTarget),
        icon: "size-11 rounded-full",
        "icon-lg": "size-14 rounded-full [&_svg:not([class*='size-'])]:size-6",
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
