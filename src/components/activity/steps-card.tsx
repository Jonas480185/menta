"use client";

import { ChevronRight, Footprints, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { setDailyStepsAction } from "@/app/(app)/activity/actions";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { toast } from "@/components/ui/sonner";
import { focusRing } from "@/components/ui/tokens";
import { ACTIVITY_LIMITS } from "@/domain/activity";
import type { IsoDate } from "@/lib/dates";
import { formatKcal, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ValueSheet } from "./value-sheet";

export interface StepsCardProps {
  date: IsoDate;
  steps: number;
  stepGoal: number;
  /** Net kcal of the steps – informational only, never added to the budget. */
  stepsKcalEstimate: number;
  weightIsFallback: boolean;
  /** Detail link (dashboard usage). Omit / pass `null` to render a plain heading (the /activity page itself). */
  href?: string | null;
  className?: string;
}

/**
 * Steps of the day: progress vs. the daily goal, an informational (not budget-relevant) kcal
 * estimate, and an edit sheet (manual entry – see docs/architecture/activity-integrations.md).
 */
export function StepsCard({ date, steps, stepGoal, stepsKcalEstimate, weightIsFallback, href, className }: StepsCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const reached = stepGoal > 0 && steps >= stepGoal;
  const link = href === null ? null : (href ?? `/activity?date=${date}`);

  return (
    <Card className={cn("gap-3 px-card", className)} aria-label="Schritte">
      <div className="flex items-center justify-between gap-2">
        {link ? (
          <Link
            href={link}
            className={cn(
              "inline-flex w-fit items-center gap-0.5 rounded-xs text-body-sm font-medium text-muted-foreground hover:text-foreground",
              focusRing,
            )}
          >
            Schritte
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <p className="text-body-sm font-medium text-muted-foreground">Schritte</p>
        )}
        <IconButton label="Schritte bearbeiten" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil />
        </IconButton>
      </div>

      <div className="flex items-center gap-4">
        <ProgressRing
          value={steps}
          max={stepGoal}
          label="Schritte"
          unit="Schritte"
          tone="activity"
          track="soft"
          size={56}
          strokeWidth={6}
        >
          <Footprints className="size-5 text-activity-strong" aria-hidden="true" />
        </ProgressRing>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-headline text-foreground tabular" aria-live="polite">
            {formatNumber(steps)}
            {stepGoal > 0 && <span className="text-body-sm font-normal text-muted-foreground"> / {formatNumber(stepGoal)}</span>}
          </p>
          {reached ? (
            <p className="text-caption font-medium text-activity-strong">Schrittziel erreicht.</p>
          ) : steps > 0 ? (
            <p className="text-caption text-muted-foreground">
              ≈ {formatKcal(Math.round(stepsKcalEstimate))} (informativ{weightIsFallback ? ", 70 kg angenommen" : ""})
            </p>
          ) : (
            <p className="text-caption text-muted-foreground">Noch keine Schritte eingetragen.</p>
          )}
        </div>
      </div>

      <ValueSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Schritte"
        description="Alltagsschritte fließen nicht ins Kalorienbudget – sie stecken bereits in deinem Aktivitätslevel."
        label="Schritte"
        unit="Schritte"
        initialValue={steps}
        min={ACTIVITY_LIMITS.steps.min}
        max={ACTIVITY_LIMITS.steps.max}
        step={100}
        submitLabel="Speichern"
        onSubmit={(value) => setDailyStepsAction({ date, steps: value })}
        onSuccess={() => toast.success("Schritte gespeichert.")}
      />
    </Card>
  );
}
