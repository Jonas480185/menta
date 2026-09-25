import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

import { focusRing } from "./tokens";

const cardVariants = cva("flex flex-col gap-4 rounded-xl py-5 text-card-foreground", {
  variants: {
    variant: {
      /** Soft shadow in light mode, hairline border in dark mode. */
      default: "border border-border/60 bg-card shadow-sm shadow-foreground/5 dark:border-border dark:shadow-none",
      outline: "border border-border bg-card",
      /** Tinted, borderless – for nested / secondary blocks inside a card or page. */
      muted: "bg-muted/60",
    },
    interactive: {
      true: cn(
        "cursor-pointer text-left transition-[box-shadow,border-color,scale] duration-150 ease-out hover:border-border hover:shadow-md active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
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
  return <Comp data-slot="card" className={cn(cardVariants({ variant, interactive }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("text-base leading-snug font-semibold tracking-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
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
  return <div data-slot="card-content" className={cn("px-5", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center gap-2 px-5", className)} {...props} />;
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardVariants };
