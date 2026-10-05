"use client";

import { ChevronRight, Plus, Scale } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TrendDirection, WeightTrendPoint } from "@/domain/weight";
import type { IsoDate } from "@/lib/dates";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

import { changeLabel, MIN_ENTRIES_FOR_TREND } from "./copy";
import { LogWeightSheet } from "./log-weight-sheet";
import { WeightTrendChart } from "./weight-trend-chart";

/** Neutral delta chip: mint when the change points towards the goal, grey otherwise (never red). */
export function WeightDeltaChip({
  kg,
  days,
  direction,
  className,
}: {
  kg: number | null;
  days: number;
  direction?: TrendDirection | null;
  className?: string;
}) {
  if (kg === null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs px-1.5 py-0.5 text-caption tabular",
        direction === "towards" ? "bg-primary-soft text-primary-strong" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {changeLabel(kg, days)}
    </span>
  );
}

/** Subset of getWeightTrend() the card needs (pass the whole WeightTrend). */
export interface WeightSummaryData {
  points: readonly WeightTrendPoint[];
  current: { date: IsoDate; weightKg: number } | null;
  trendCurrent: number | null;
  change7d: number | null;
  entryCount: number;
  goal: { targetKg: number; direction: TrendDirection } | null;
}

export interface WeightSummaryCardProps {
  data: WeightSummaryData;
  /** The user's today. */
  today: IsoDate;
  /** Detail page. Default "/progress/weight". */
  href?: string;
  className?: string;
}

/**
 * Compact dashboard card: trend weight (or the last reading while there's no trend yet),
 * 7-day change, a 30-day sparkline and "Gewicht eintragen".
 */
export function WeightSummaryCard({
  data,
  today,
  href = "/progress/weight",
  className,
}: WeightSummaryCardProps) {
  const hasTrend = data.entryCount >= MIN_ENTRIES_FOR_TREND && data.trendCurrent !== null;
  const value = hasTrend ? data.trendCurrent : (data.current?.weightKg ?? null);
  const spark = useMemo(() => data.points.slice(-30), [data.points]);
  const existing = useMemo(() => {
    const map: Record<IsoDate, number> = {};
    for (const p of data.points) if (p.weightKg !== null) map[p.date] = p.weightKg;
    return map;
  }, [data.points]);

  return (
    <Card className={cn("gap-3", className)}>
      <div className="flex items-center justify-between gap-2 px-card">
        <Link
          href={href}
          className="-m-1 inline-flex min-h-11 items-center gap-2 rounded-sm p-1 text-body-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-sm bg-weight-soft text-weight-strong"
          >
            <Scale className="size-4" />
          </span>
          Gewicht
          <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden="true" />
        </Link>
        {data.goal && (
          <span className="text-caption text-muted-foreground tabular">
            Ziel {formatNumber(data.goal.targetKg, { minFractionDigits: 1, maxFractionDigits: 1 })} kg
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 px-card">
        <div className="flex min-w-0 flex-col gap-1">
          {value !== null ? (
            <p className="flex items-baseline gap-1">
              <span className="numeric text-stat text-foreground">
                {formatNumber(value, { minFractionDigits: 1, maxFractionDigits: 1 })}
              </span>
              <span className="text-body-sm text-muted-foreground">kg</span>
            </p>
          ) : (
            <p className="text-body text-muted-foreground">Noch kein Gewicht eingetragen.</p>
          )}
          {hasTrend ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-caption text-muted-foreground">Trend</span>
              <WeightDeltaChip kg={data.change7d} days={7} direction={data.goal?.direction} />
            </div>
          ) : data.current ? (
            <p className="text-caption text-muted-foreground">
              Letzte Messung: {formatRelativeDay(data.current.date, today)}
            </p>
          ) : null}
        </div>
        {spark.some((p) => p.weightKg !== null || p.trend !== null) && (
          <WeightTrendChart
            points={spark}
            compact
            showTrend={hasTrend}
            height={48}
            className="w-28 shrink-0"
          />
        )}
      </div>

      <div className="px-card">
        <LogWeightSheet
          today={today}
          lastWeightKg={data.current?.weightKg ?? null}
          existing={existing}
          trigger={
            <Button variant="soft" block>
              <Plus aria-hidden="true" />
              Gewicht eintragen
            </Button>
          }
        />
      </div>
    </Card>
  );
}
