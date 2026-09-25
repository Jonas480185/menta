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
    "inset-y-0 right-0 h-full w-[88%] max-w-sm border-l pr-[env(safe-area-inset-right)] starting:translate-x-full",
  left: "inset-y-0 left-0 h-full w-[88%] max-w-sm border-r pl-[env(safe-area-inset-left)] starting:-translate-x-full",
  top: "inset-x-0 top-0 h-auto max-h-[85dvh] border-b pt-[env(safe-area-inset-top)] starting:-translate-y-full",
  bottom:
    "inset-x-0 bottom-0 h-auto max-h-[85dvh] rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] starting:translate-y-full",
} as const;

export interface SheetContentProps extends React.ComponentProps<typeof SheetPrimitive.Content> {
  side?: keyof typeof sideClasses;
  showCloseButton?: boolean;
}

/**
 * Edge panel (filters, desktop side panels, navigation). For mobile logging flows use
 * the draggable `BottomSheet` (drawer.tsx) instead.
 */
function SheetContent({ className, children, side = "right", showCloseButton = true, ...props }: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay data-slot="sheet-overlay" className={overlayScrim} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-card text-card-foreground shadow-2xl shadow-foreground/20 outline-none",
          "transition-[translate] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
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
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-5 pr-14", className)} {...props} />;
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("flex-1 px-5", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-5", className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg leading-tight font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Sheet, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger };
