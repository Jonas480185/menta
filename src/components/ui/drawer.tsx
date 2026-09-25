"use client";

import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

/**
 * Draggable bottom sheet (vaul) – the primary mobile surface for logging, portion
 * pickers and quick actions. Exported twice: `Drawer*` (shadcn naming) and
 * `BottomSheet*` (product naming). Both are the same components.
 *
 * - Drag handle + swipe-to-close; Esc / scrim tap close; focus is trapped (Radix Dialog).
 * - Keyboard-safe: vaul repositions focused inputs above the on-screen keyboard
 *   (`repositionInputs`, on by default); content is capped at 92 dvh and scrolls inside
 *   `DrawerBody`; footer respects the home-indicator safe area.
 * - Snap points: `<Drawer snapPoints={[0.5, 1]}>` + `<DrawerContent fullHeight>`.
 */
function Drawer({ repositionInputs = true, ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" repositionInputs={repositionInputs} {...props} />;
}

function DrawerTrigger(props: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal(props: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose(props: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn("fixed inset-0 z-50 bg-foreground/40 dark:bg-background/75", className)}
      {...props}
    />
  );
}

export interface DrawerContentProps extends React.ComponentProps<typeof DrawerPrimitive.Content> {
  /** Use with snap points: the sheet is full height and vaul translates it between points. */
  fullHeight?: boolean;
  /** Show the grab handle (default true). */
  showHandle?: boolean;
}

function DrawerContent({ className, children, fullHeight = false, showHandle = true, ...props }: DrawerContentProps) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-lg flex-col rounded-t-xl border border-b-0 border-border bg-card text-card-foreground shadow-2xl shadow-foreground/20 outline-none",
          fullHeight ? "h-[96dvh] max-h-[96dvh]" : "max-h-[92dvh]",
          className,
        )}
        {...props}
      >
        {showHandle && (
          <div className="flex shrink-0 justify-center pt-2.5 pb-1.5" aria-hidden="true">
            <DrawerPrimitive.Handle
              data-slot="drawer-handle"
              className="h-1.5! w-10! rounded-full! bg-muted-foreground/35! opacity-100!"
            />
          </div>
        )}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="drawer-header" className={cn("flex shrink-0 flex-col gap-1 px-5 pt-2 pb-3", className)} {...props} />;
}

/** Scrollable middle area; overscroll is contained so the page behind never scrolls. */
function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="drawer-body" className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4", className)} {...props} />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "flex shrink-0 flex-col gap-2 border-t border-border/60 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-lg leading-tight font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description data-slot="drawer-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export {
  Drawer as BottomSheet,
  DrawerBody as BottomSheetBody,
  DrawerClose as BottomSheetClose,
  DrawerContent as BottomSheetContent,
  DrawerDescription as BottomSheetDescription,
  DrawerFooter as BottomSheetFooter,
  DrawerHeader as BottomSheetHeader,
  DrawerTitle as BottomSheetTitle,
  DrawerTrigger as BottomSheetTrigger,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
