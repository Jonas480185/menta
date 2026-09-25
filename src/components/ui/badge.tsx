import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

import { focusRing } from "./tokens";

const badgeVariants = cva(
  cn(
    "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-sm px-2 text-caption whitespace-nowrap tabular [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5",
    focusRing,
  ),
  {
    variants: {
      variant: {
        neutral: "bg-muted text-foreground",
        primary: "bg-primary-soft text-primary-strong",
        solid: "bg-primary text-primary-foreground",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        info: "bg-info-soft text-info",
        destructive: "bg-destructive-soft text-destructive",
        outline: "border border-border-strong text-foreground",
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
