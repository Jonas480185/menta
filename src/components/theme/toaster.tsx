"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "./theme-provider";

const iconProps = { className: "size-[18px]", strokeWidth: 1.75, "aria-hidden": true } as const;

/**
 * Themed sonner Toaster (mounted once in the root layout).
 * Bottom-center; on mobile it floats above the bottom navigation + safe-area inset.
 * Usage anywhere: `import { toast } from "sonner"; toast.success("Gespeichert")`.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme ?? "system"}
      position="bottom-center"
      offset={{ bottom: "1.5rem" }}
      mobileOffset={{
        bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 0.75rem)",
      }}
      gap={8}
      visibleToasts={3}
      icons={{
        success: <CircleCheck {...iconProps} />,
        info: <Info {...iconProps} />,
        warning: <TriangleAlert {...iconProps} />,
        error: <CircleAlert {...iconProps} />,
        loading: <LoaderCircle {...iconProps} className="size-[18px] animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface-3)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--surface-3)",
          "--success-text": "var(--foreground)",
          "--success-border": "var(--border)",
          "--error-bg": "var(--surface-3)",
          "--error-text": "var(--foreground)",
          "--error-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "font-sans shadow-lg! text-body-sm!",
          description: "text-muted-foreground!",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-destructive",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-info",
          actionButton: "bg-primary! text-primary-foreground! rounded-md! font-medium!",
          cancelButton: "bg-muted! text-foreground! rounded-md!",
        },
      }}
    />
  );
}
