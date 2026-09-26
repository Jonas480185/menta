"use client";

import { ChevronRight, Droplet } from "lucide-react";
import Link from "next/link";
import { useOptimistic } from "react";

import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { focusRing } from "@/components/ui/tokens";
import type { IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { AddWaterButton } from "./add-water-button";
import { formatWaterAmount, formatWaterProgress } from "./format";

export interface WaterCardProps {
  date: IsoDate;
  totalMl: number;
  goalMl: number;
  /** Detail link, default `/activity?date=<date>`. */
  href?: string;
  /** Quick-add amount, default 250 ml. */
  quickAddMl?: number;
  className?: string;
}

/**
 * Compact dashboard card: water progress ring + one-tap "+ 250 ml" (optimistic).
 * Data comes from `getWaterSummary(ctx, date)` on the server.
 */
export function WaterCard({ date, totalMl, goalMl, href, quickAddMl = 250, className }: WaterCardProps) {
  const [total, addOptimistic] = useOptimistic(totalMl, (current: number, ml: number) => current + ml);
  const reached = goalMl > 0 && total >= goalMl;
  const link = href ?? `/activity?date=${date}`;

  return (
    <Card className={cn("gap-3 px-card", className)} aria-label="Wasser">
      <div className="flex items-center gap-3">
        <ProgressRing
          value={total}
          max={goalMl}
          label="Wasser"
          valueText={formatWaterProgress(total, goalMl)}
          tone="water"
          track="soft"
          size={56}
          strokeWidth={6}
        >
          <Droplet className="size-5 text-water-strong" aria-hidden="true" />
        </ProgressRing>
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={link}
            className={cn(
              "inline-flex w-fit items-center gap-0.5 rounded-xs text-body-sm font-medium text-muted-foreground hover:text-foreground",
              focusRing,
            )}
          >
            Wasser
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
          <p className="text-headline text-foreground tabular" aria-live="polite">
            {formatWaterAmount(total)}
            {goalMl > 0 && (
              <span className="text-body-sm font-normal text-muted-foreground"> / {formatWaterAmount(goalMl)}</span>
            )}
          </p>
          {reached && <p className="text-caption font-medium text-water-strong">Wasserziel erreicht.</p>}
        </div>
      </div>
      <AddWaterButton date={date} amountMl={quickAddMl} onOptimisticAdd={addOptimistic} block />
    </Card>
  );
}
