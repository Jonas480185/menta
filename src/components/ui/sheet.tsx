"use client";

import { Dialog as SheetPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { OverlayCloseButton } from "./dialog";
import { overlayScrim } from "./tokens";

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

const sideClasses = {
  right:
    "inset-y-0 right-0 h-full w-[88%] max-w-sm pr-safe pt-safe transition-[translate] duration-300 ease-out starting:translate-x-full dark:border-l",
  left: "inset-y-0 left-0 h-full w-[88%] max-w-sm pl-safe pt-safe transition-[translate] duration-300 ease-out starting:-translate-x-full dark:border-r",
  top: "inset-x-0 top-0 h-auto max-h-[85dvh] pt-safe transition-[translate] duration-300 ease-out starting:-translate-y-full dark:border-b",
  bottom:
    "inset-x-0 bottom-0 h-auto max-h-[85dvh] rounded-t-sheet pb-safe data-[state=open]:animate-slide-up data-[state=closed]:animate-slide-down dark:border-t",
} as const;

export interface SheetContentProps extends React.ComponentProps<typeof SheetPrimitive.Content> {
  side?: keyof typeof sideClasses;
  showCloseButton?: boolean;
}

/**
 * Edge panel (filters, desktop side panels, navigation). Side panels slide in; exits are
 * instant. For mobile logging flows use the draggable `BottomSheet` (drawer.tsx) instead.
 */
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay data-slot="sheet-overlay" className={overlayScrim} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-surface-2 text-foreground shadow-lg outline-none",
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && <OverlayCloseButton />}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-5 pr-14", className)} {...props} />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("flex-1 px-5", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-5", className)} {...props} />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title data-slot="sheet-title" className={cn("text-heading", className)} {...props} />
  );
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-body-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
