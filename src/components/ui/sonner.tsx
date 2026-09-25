"use client";

import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";
import { useTheme } from "next-themes";
import { toast, Toaster as Sonner, type ExternalToast, type ToasterProps } from "sonner";

import { Spinner } from "./spinner";

/**
 * App-wide toast outlet. Mount once in the app shell. Bottom-centre, lifted above the
 * mobile bottom navigation and the home indicator.
 */
function Toaster(props: ToasterProps) {
  const { theme = "system" } = useTheme();
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-center"
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}
      gap={8}
      icons={{
        success: <CircleCheck className="size-5 text-success" aria-hidden="true" />,
        info: <Info className="size-5 text-muted-foreground" aria-hidden="true" />,
        warning: <CircleAlert className="size-5 text-warning" aria-hidden="true" />,
        error: <CircleX className="size-5 text-destructive" aria-hidden="true" />,
        loading: <Spinner size="sm" aria-hidden="true" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "gap-3! px-4! py-3! shadow-lg! shadow-foreground/10! font-sans! text-sm!",
          title: "font-medium!",
          description: "text-muted-foreground!",
          actionButton:
            "h-8! rounded-full! bg-primary/15! px-3! text-sm! font-semibold! text-foreground! transition-colors hover:bg-primary/25!",
          cancelButton: "h-8! rounded-full! bg-secondary! px-3! text-sm! text-secondary-foreground!",
        },
      }}
      {...props}
    />
  );
}

export interface UndoToastOptions extends Omit<ExternalToast, "action"> {
  onUndo: () => void;
  /** Button label, default "Rückgängig". */
  undoLabel?: string;
}

/**
 * Standard "done – undo?" toast for reversible actions, e.g.
 * `undoToast("Eintrag gelöscht", { onUndo: () => restore(entry) })`.
 */
function undoToast(message: React.ReactNode, { onUndo, undoLabel = "Rückgängig", duration = 6000, ...options }: UndoToastOptions) {
  return toast(message, { ...options, duration, action: { label: undoLabel, onClick: onUndo } });
}

export { toast, Toaster, undoToast };
