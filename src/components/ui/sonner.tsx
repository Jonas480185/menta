"use client";

import { toast, type ExternalToast } from "sonner";

/*
 * The themed <Toaster /> is mounted once in the root layout
 * (src/components/theme/toaster.tsx). This module only adds helpers.
 */

export interface UndoToastOptions extends Omit<ExternalToast, "action"> {
  onUndo: () => void;
  /** Button label, default "Rückgängig". */
  undoLabel?: string;
}

/**
 * Standard "done – undo?" toast for cheap, reversible actions, e.g.
 * `undoToast("Eintrag gelöscht", { onUndo: () => restore(entry) })`.
 * Prefer this over a confirm dialog when the action can be undone.
 */
function undoToast(
  message: React.ReactNode,
  { onUndo, undoLabel = "Rückgängig", duration = 6000, ...options }: UndoToastOptions,
) {
  return toast(message, { ...options, duration, action: { label: undoLabel, onClick: onUndo } });
}

export { toast, undoToast };
