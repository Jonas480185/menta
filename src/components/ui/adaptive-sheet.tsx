"use client";

import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";
import { DESKTOP_QUERY, useMediaQuery } from "./use-media-query";

export interface AdaptiveSheetProps {
  /** Element that opens the sheet (rendered via `asChild`). Omit when controlling `open`. */
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Required for screen readers; hide visually with `hideHeader`. */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Visually hide title + description (still announced). */
  hideHeader?: boolean;
  children: React.ReactNode;
  /** Sticky action area (primary button). */
  footer?: React.ReactNode;
  /** Mobile only: vaul snap points, e.g. `[0.55, 1]`. */
  snapPoints?: (number | string)[];
  className?: string;
}

/**
 * The logging surface: a draggable bottom sheet on phones/tablets and a centred dialog
 * at ≥ lg (docs/design/visual-language.md §4). Same content, same API.
 */
function AdaptiveSheet({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  hideHeader = false,
  children,
  footer,
  snapPoints,
  className,
}: AdaptiveSheetProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className={cn("gap-0 p-0", className)}>
          <DialogHeader className={cn("px-6 pt-6 pb-3", hideHeader && "sr-only")}>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div data-slot="adaptive-sheet-body" className="min-h-0 overflow-y-auto px-6 pb-6">
            {children}
          </div>
          {footer && <DialogFooter className="border-t border-border px-6 py-4">{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} snapPoints={snapPoints}>
      {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
      <DrawerContent fullHeight={snapPoints !== undefined} className={className}>
        <DrawerHeader className={cn(hideHeader && "sr-only")}>
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <DrawerBody>{children}</DrawerBody>
        {footer && <DrawerFooter>{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}

export { AdaptiveSheet };
