import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

import { cardSurface, focusRing } from "./tokens";

const cardVariants = cva("flex flex-col gap-4 rounded-card py-card text-card-foreground", {
  variants: {
    variant: {
      /** Elevation 1: soft shadow in light mode, hairline border in dark mode. */
      default: cardSurface,
      outline: "border border-border bg-card",
      /** Inset well without shadow – for nested / secondary blocks (never stack shadows). */
      muted: "bg-surface-inset",
    },
    interactive: {
      true: cn(
        "cursor-pointer text-left transition-[box-shadow,border-color,scale] duration-150 ease-out hover:shadow-md active:scale-[0.99] motion-reduce:active:scale-100",
        focusRing,
      ),
      false: "",
    },
  },
  defaultVariants: { variant: "default", interactive: false },
});

export interface CardProps extends React.ComponentProps<"div">, VariantProps<typeof cardVariants> {
  /** Render the child (e.g. `<Link>`) as the card – use with `interactive` for tappable cards. */
  asChild?: boolean;
}

function Card({ className, variant, interactive, asChild = false, ...props }: CardProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp data-slot="card" className={cn(cardVariants({ variant, interactive }), className)} {...props} />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-card has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("text-heading", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-body-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Top-right slot in the header (menu, link, badge). */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-card", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-footer" className={cn("flex items-center gap-2 px-card", className)} {...props} />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardVariants };
