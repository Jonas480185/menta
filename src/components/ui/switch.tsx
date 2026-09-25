"use client";

import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { focusRing, touchTarget } from "./tokens";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-border-strong",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        touchTarget,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-6 rounded-full bg-card shadow-sm ring-0 dark:bg-foreground",
          "transition-transform duration-300 ease-spring",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
