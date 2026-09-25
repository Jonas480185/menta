"use client";

import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { focusRing } from "./tokens";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />;
}

export interface TabsListProps extends React.ComponentProps<typeof TabsPrimitive.List> {
  /**
   * `underline` (default) for page sections, `pill` for compact in-card switching.
   * For small option sets that behave like a filter (7T/30T/…) prefer `SegmentedControl`.
   */
  variant?: "underline" | "pill";
}

function TabsList({ className, variant = "underline", ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        "group/tabs-list inline-flex w-fit items-center text-muted-foreground",
        variant === "underline" && "w-full gap-6 overflow-x-auto border-b border-border [scrollbar-width:none]",
        variant === "pill" && "h-11 gap-1 rounded-full bg-muted p-1",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex cursor-pointer items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none",
        "hover:text-foreground data-[state=active]:text-foreground disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // underline
        "group-data-[variant=underline]/tabs-list:h-11 group-data-[variant=underline]/tabs-list:rounded-sm",
        "group-data-[variant=underline]/tabs-list:after:absolute group-data-[variant=underline]/tabs-list:after:inset-x-0 group-data-[variant=underline]/tabs-list:after:-bottom-px group-data-[variant=underline]/tabs-list:after:h-0.5 group-data-[variant=underline]/tabs-list:after:rounded-full group-data-[variant=underline]/tabs-list:after:bg-primary group-data-[variant=underline]/tabs-list:after:opacity-0 group-data-[variant=underline]/tabs-list:after:transition-opacity group-data-[variant=underline]/tabs-list:data-[state=active]:after:opacity-100",
        // pill
        "group-data-[variant=pill]/tabs-list:h-full group-data-[variant=pill]/tabs-list:flex-1 group-data-[variant=pill]/tabs-list:rounded-full group-data-[variant=pill]/tabs-list:px-4",
        "group-data-[variant=pill]/tabs-list:data-[state=active]:bg-background group-data-[variant=pill]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=pill]/tabs-list:data-[state=active]:shadow-foreground/10 dark:group-data-[variant=pill]/tabs-list:data-[state=active]:bg-card",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", focusRing, className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
