import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

import { focusRing } from "./tokens";

const badgeVariants = cva(
  cn(
    "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap tabular-nums [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5",
    focusRing,
  ),
  {
    variants: {
      variant: {
        neutral: "bg-secondary text-secondary-foreground",
        primary: "bg-primary/15 text-foreground",
        solid: "bg-primary text-primary-foreground",
        success: "bg-success/15 text-foreground [&_svg]:text-success",
        warning: "bg-warning/15 text-foreground [&_svg]:text-warning",
        destructive: "bg-destructive/15 text-foreground [&_svg]:text-destructive",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
