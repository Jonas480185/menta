"use client";

import { Plus } from "lucide-react";
import { useTransition } from "react";

import { addWaterAction, deleteWaterAction } from "@/app/(app)/activity/actions";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast, undoToast } from "@/components/ui/sonner";
import type { IsoDate } from "@/lib/dates";
import { formatMl } from "@/lib/format";
import { NETWORK_ERROR } from "@/lib/use-action";

export interface AddWaterButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  date: IsoDate;
  /** Default 250 ml. */
  amountMl?: number;
  /**
   * Called inside the transition right before the server action: pass a `useOptimistic` setter
   * to show the new total immediately. React rolls it back automatically when the action fails.
   */
  onOptimisticAdd?: (amountMl: number) => void;
}

/**
 * One-tap water logging ("+ 250 ml"): optimistic, toast with "Rückgängig". Rapid taps are fine:
 * each tap is its own transition and entry.
 */
export function AddWaterButton({
  date,
  amountMl = 250,
  onOptimisticAdd,
  variant = "soft",
  size = "sm",
  ...props
}: AddWaterButtonProps) {
  const [, startTransition] = useTransition();
  const label = formatMl(amountMl);

  const add = () =>
    startTransition(async () => {
      onOptimisticAdd?.(amountMl);
      let result: Awaited<ReturnType<typeof addWaterAction>>;
      try {
        result = await addWaterAction({ date, amountMl });
      } catch {
        toast.error(NETWORK_ERROR.message);
        return;
      }
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const id = result.data.id;
      undoToast(`${label} Wasser hinzugefügt.`, {
        id: `water-add-${id}`,
        onUndo: () => {
          void deleteWaterAction({ id })
            .then((r) => {
              if (!r.ok) toast.error(r.error.message);
            })
            .catch(() => toast.error(NETWORK_ERROR.message));
        },
      });
    });

  return (
    <Button type="button" variant={variant} size={size} aria-label={`${label} Wasser hinzufügen`} onClick={add} {...props}>
      <Plus aria-hidden="true" />
      {label}
    </Button>
  );
}
