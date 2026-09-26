"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Milo } from "@/components/mascot/milo";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Label } from "@/components/ui/label";
import { ListGroup, ListItem } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import {
  formatMonthYear,
  formatWeeklyRate,
  formatWeightDelta,
  MIN_ENTRIES_FOR_TREND,
  projectionText,
  trendMessage,
} from "@/components/weight/copy";
import { LogWeightSheet, type EditableWeightEntry } from "@/components/weight/log-weight-sheet";
import { WeightDeltaChip } from "@/components/weight/weight-summary-card";
import { WeightTrendChart } from "@/components/weight/weight-trend-chart";
import { slicePoints, WEIGHT_RANGES, type WeightRange } from "@/domain/weight";
import { addDays, type IsoDate } from "@/lib/dates";
import { formatDateLong, formatNumber, formatPercent, formatRelativeDay, formatWeightKg } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import type { WeightEntry, WeightTrend } from "@/server/services/weight";

import { deleteWeightAction, logWeightAction } from "../actions";

const PAGE_SIZE = 60;

export interface WeightProgressViewProps {
  trend: WeightTrend;
  /** All entries, oldest first. */
  entries: WeightEntry[];
  today: IsoDate;
}

export function WeightProgressView({ trend, entries, today }: WeightProgressViewProps) {
  const [range, setRange] = useState<WeightRange>(() =>
    trend.firstEntryDate && trend.firstEntryDate < addDays(today, -45) ? "3m" : "30d",
  );
  const [showAverage, setShowAverage] = useState(false);
  const [editing, setEditing] = useState<EditableWeightEntry | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const startEdit = (entry: EditableWeightEntry) => {
    setEditing(entry);
    setEditOpen(true);
  };

  const [deletedDates, removeOptimistic] = useOptimistic<IsoDate[], IsoDate>([], (state, date) => [
    ...state,
    date,
  ]);
  const [, startTransition] = useTransition();

  const visibleEntries = useMemo(
    () => entries.filter((e) => !deletedDates.includes(e.date)),
    [entries, deletedDates],
  );
  const existing = useMemo(() => {
    const map: Record<IsoDate, number> = {};
    for (const e of visibleEntries) map[e.date] = e.weightKg;
    return map;
  }, [visibleEntries]);
  const latest = visibleEntries.at(-1) ?? null;

  const restore = useAction(logWeightAction, { successMessage: "Eintrag wiederhergestellt." });
  const remove = useAction(deleteWeightAction, {
    onSuccess: (deleted) => {
      toast("Eintrag gelöscht.", {
        action: {
          label: "Rückgängig",
          onClick: () =>
            void restore.execute({
              date: deleted.date,
              weightKg: deleted.weightKg,
              bodyFatPct: deleted.bodyFatPct,
              note: deleted.note,
            }),
        },
      });
    },
  });
  const onDelete = (date: IsoDate) =>
    startTransition(async () => {
      removeOptimistic(date);
      await remove.execute(date);
    });

  const logButton = (
    <LogWeightSheet
      today={today}
      lastWeightKg={latest?.weightKg ?? null}
      existing={existing}
      trigger={
        <Button size="sm">
          <Plus aria-hidden="true" />
          Eintragen
        </Button>
      }
    />
  );

  const header = (
    <PageHeader
      title="Gewicht"
      back={{ href: "/progress", label: "Fortschritt" }}
      actions={visibleEntries.length > 0 ? logButton : undefined}
    />
  );

  if (visibleEntries.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card>
          <EmptyState
            illustration={<Milo mood="encouraging" size={88} />}
            title="Noch kein Gewicht eingetragen."
            description="Ein Eintrag pro Woche reicht für einen ersten Trend."
            action={
              <LogWeightSheet
                today={today}
                trigger={
                  <Button>
                    <Plus aria-hidden="true" />
                    Gewicht eintragen
                  </Button>
                }
              />
            }
          />
        </Card>
      </div>
    );
  }

  const hasTrend = trend.entryCount >= MIN_ENTRIES_FOR_TREND && trend.trendCurrent !== null;
  const heroValue = hasTrend ? trend.trendCurrent : (latest?.weightKg ?? null);
  const message = trendMessage({ entryCount: trend.entryCount, change7d: trend.change7d, goal: trend.goal });
  const direction = trend.goal?.direction ?? null;

  return (
    <div className="flex flex-col gap-6">
      {header}

      {/* Hero: the smoothed trend weight, not the last reading. */}
      <Card asChild>
        <section aria-labelledby="weight-hero-label">
          <CardContent className="flex flex-col gap-3">
            <p id="weight-hero-label" className="text-body-sm font-medium text-muted-foreground">
              {hasTrend ? "Trendgewicht" : "Letzte Messung"}
            </p>
            <p className="flex items-baseline gap-1.5">
              <span className="numeric text-display text-foreground">
                {formatNumber(heroValue, { minFractionDigits: 1, maxFractionDigits: 1 })}
              </span>
              <span className="text-heading text-muted-foreground">kg</span>
            </p>
            {hasTrend && (
              <div className="flex flex-wrap items-center gap-1.5">
                <WeightDeltaChip kg={trend.change7d} days={7} direction={direction} />
                <WeightDeltaChip kg={trend.change30d} days={30} direction={direction} />
                {trend.weeklyRate !== null && (
                  <span className="text-caption text-muted-foreground tabular">
                    ≈ {formatWeeklyRate(trend.weeklyRate)}
                  </span>
                )}
              </div>
            )}
            <p className="text-body text-pretty text-foreground">{message}</p>
            {latest && hasTrend && (
              <p className="text-caption text-muted-foreground tabular">
                Letzte Messung: {formatWeightKg(latest.weightKg)} · {formatRelativeDay(latest.date, today)}
              </p>
            )}
          </CardContent>
        </section>
      </Card>

      {trend.goal ? <GoalCard goal={trend.goal} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Verlauf</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SegmentedControl
            aria-label="Zeitraum"
            options={WEIGHT_RANGES.map((r) => ({ value: r.value, label: r.label, ariaLabel: r.ariaLabel }))}
            value={range}
            onValueChange={setRange}
            size="sm"
            block
          />
          <RangeChart
            points={trend.points}
            range={range}
            today={today}
            goalKg={trend.goal?.targetKg ?? null}
            showAverage={showAverage}
            showTrend={hasTrend}
          />
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="weight-show-avg" className="font-normal text-muted-foreground">
              7-Tage-Durchschnitt anzeigen
            </Label>
            <Switch id="weight-show-avg" checked={showAverage} onCheckedChange={setShowAverage} />
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="weight-entries" className="flex flex-col gap-4">
        <h2 id="weight-entries" className="text-heading">
          Einträge
        </h2>
        <EntryList entries={visibleEntries} today={today} onEdit={startEdit} onDelete={onDelete} />
      </section>

      <LogWeightSheet
        today={today}
        entry={editing}
        lastWeightKg={latest?.weightKg ?? null}
        open={editOpen && editing !== null}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

function GoalCard({ goal }: { goal: NonNullable<WeightTrend["goal"]> }) {
  const { progress } = goal;
  const pct = progress.fraction === null ? null : Math.round(progress.fraction * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ziel</CardTitle>
        <CardAction>
          <span className="numeric text-headline text-foreground">{formatWeightKg(goal.targetKg)}</span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {pct !== null && (
          <div className="flex flex-col gap-1.5">
            <div
              role="progressbar"
              aria-label="Fortschritt zum Zielgewicht"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={formatPercent(progress.fraction)}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-weight transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-caption text-muted-foreground tabular">
              <span>Start {formatWeightKg(goal.startKg)}</span>
              <span>{formatPercent(progress.fraction)}</span>
            </div>
          </div>
        )}
        <p className="text-body-sm text-muted-foreground">
          {projectionText(goal.targetKg, goal.projectedDate, progress)}
        </p>
      </CardContent>
    </Card>
  );
}

function RangeChart({
  points,
  range,
  today,
  goalKg,
  showAverage,
  showTrend,
}: {
  points: WeightTrend["points"];
  range: WeightRange;
  today: IsoDate;
  goalKg: number | null;
  showAverage: boolean;
  showTrend: boolean;
}) {
  const visible = useMemo(() => slicePoints(points, range, today), [points, range, today]);
  const measured = visible.filter((p) => p.weightKg !== null).length;
  const trendValues = visible.filter((p) => p.trend !== null);
  const change =
    showTrend && trendValues.length > 1 ? trendValues.at(-1)!.trend! - trendValues[0].trend! : null;

  if (measured === 0 && trendValues.length === 0) {
    return (
      <p className="py-10 text-center text-body-sm text-muted-foreground">
        Keine Messungen in diesem Zeitraum.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <WeightTrendChart
        key={range}
        points={visible}
        range={range}
        goalKg={goalKg}
        showAverage={showAverage}
        showTrend={showTrend}
        className="motion-safe:animate-fade-in"
      />
      <p className="text-body-sm text-muted-foreground tabular">
        {change !== null ? `Trend im Zeitraum: ${formatWeightDelta(change)} · ` : ""}
        {measured} {measured === 1 ? "Messung" : "Messungen"}
      </p>
    </div>
  );
}

function EntryList({
  entries,
  today,
  onEdit,
  onDelete,
}: {
  entries: WeightEntry[];
  today: IsoDate;
  onEdit: (entry: WeightEntry) => void;
  onDelete: (date: IsoDate) => void;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const newestFirst = useMemo(() => [...entries].reverse(), [entries]);
  const shown = newestFirst.slice(0, limit);
  const groups = useMemo(() => {
    const out: { month: string; items: WeightEntry[] }[] = [];
    for (const e of shown) {
      const month = formatMonthYear(e.date);
      const last = out.at(-1);
      if (last && last.month === month) last.items.push(e);
      else out.push({ month, items: [e] });
    }
    return out;
  }, [shown]);

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <ListGroup key={g.month} title={g.month}>
          {g.items.map((e) => {
            const details = [
              e.bodyFatPct !== null
                ? `Körperfett ${formatNumber(e.bodyFatPct, { maxFractionDigits: 1 })} %`
                : null,
              e.note,
            ].filter(Boolean);
            return (
              <ListItem
                key={e.date}
                title={formatRelativeDay(e.date, today)}
                description={details.length > 0 ? details.join(" · ") : undefined}
                trailing={
                  <span className="inline-flex items-center gap-2 text-body font-medium text-foreground">
                    {formatWeightKg(e.weightKg)}
                    <Pencil className="size-4 text-muted-foreground/60" aria-hidden="true" />
                  </span>
                }
                chevron={false}
                onClick={() => onEdit(e)}
                action={
                  <IconButton
                    label={`Eintrag vom ${formatDateLong(e.date, { weekday: false })} löschen`}
                    size="sm"
                    onClick={() => onDelete(e.date)}
                  >
                    <Trash2 />
                  </IconButton>
                }
              />
            );
          })}
        </ListGroup>
      ))}
      {newestFirst.length > limit && (
        <Button variant="ghost" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
          Ältere Einträge anzeigen
        </Button>
      )}
    </div>
  );
}
