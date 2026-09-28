"use client";

import { ChevronRight, Dumbbell, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { focusRing } from "@/components/ui/tokens";
import type { IsoDate } from "@/lib/dates";
import { formatKcal, NBSP } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AddActivitySheet } from "./add-activity-sheet";

export interface ActivityCardProps {
  date: IsoDate;
  /** Σ calories_burned of the day (see getActivitySummary().activeKcal). */
  activeKcal: number;
  /** Minutes of all non-steps activities. */
  minutes: number;
  /** Number of non-steps activities. */
  count: number;
  weightKg: number;
  weightIsFallback: boolean;
  /** Detail link, default `/activity?date=<date>`. */
  href?: string;
  className?: string;
}

/**
 * Compact dashboard card: today's active calories from logged workouts, plus a quick
 * "Aktivität hinzufügen". Data comes from `getActivitySummary(ctx, date)` on the server.
 */
export function ActivityCard({
  date,
  activeKcal,
  minutes,
  count,
  weightKg,
  weightIsFallback,
  href,
  className,
}: ActivityCardProps) {
  const link = href ?? `/activity?date=${date}`;

  return (
    <Card className={cn("gap-3 px-card", className)} aria-label="Aktivität">
      <Link
        href={link}
        className={cn(
          "inline-flex w-fit items-center gap-0.5 rounded-xs text-body-sm font-medium text-muted-foreground hover:text-foreground",
          focusRing,
        )}
      >
        Aktivität
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>

      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-activity-soft text-activity-strong"
        >
          <Dumbbell className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          {count > 0 ? (
            <>
              <p className="text-headline text-foreground tabular">{formatKcal(Math.round(activeKcal))}</p>
              <p className="text-caption text-muted-foreground tabular">
                {count} Aktivität{count === 1 ? "" : "en"} · {minutes}
                {NBSP}min
              </p>
            </>
          ) : (
            <p className="text-body-sm text-muted-foreground">Heute noch keine Aktivität eingetragen.</p>
          )}
        </div>
      </div>

      <AddActivitySheet
        date={date}
        weightKg={weightKg}
        weightIsFallback={weightIsFallback}
        trigger={
          <Button variant="soft" block>
            <Plus aria-hidden="true" />
            Aktivität hinzufügen
          </Button>
        }
      />
    </Card>
  );
}
