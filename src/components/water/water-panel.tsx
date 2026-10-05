"use client";

import { Droplet, GlassWater, Pencil, Plus, Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { addWaterAction, deleteWaterAction, setWaterGoalAction } from "@/app/(app)/activity/actions";
import { ValueSheet } from "@/components/activity/value-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { ListGroup, ListItem, ListItemIcon } from "@/components/ui/list";
import { ProgressRing } from "@/components/ui/progress-ring";
import { toast, undoToast } from "@/components/ui/sonner";
import { ACTIVITY_LIMITS } from "@/domain/activity";
import type { IsoDate } from "@/lib/dates";
import { formatMl } from "@/lib/format";
import { NETWORK_ERROR } from "@/lib/use-action";
import type { WaterEntry } from "@/server/services/water";

import { AddWaterButton } from "./add-water-button";
import { formatWaterAmount, formatWaterProgress } from "./format";

export const WATER_QUICK_AMOUNTS = [250, 330, 500] as const;

export interface WaterPanelProps {
  date: IsoDate;
  isToday: boolean;
  goalMl: number;
  entries: WaterEntry[];
  /** IANA timezone for entry times. */
  timezone: string;
}

type OptimisticAction = { type: "add"; entry: WaterEntry } | { type: "remove"; id: string };

function reducer(list: WaterEntry[], action: OptimisticAction): WaterEntry[] {
  return action.type === "add" ? [...list, action.entry] : list.filter((e) => e.id !== action.id);
}

/** Full water section of /activity: progress, quick-add, custom amount, goal, entry list with undo. */
export function WaterPanel({ date, isToday, goalMl, entries, timezone }: WaterPanelProps) {
  const [optimisticEntries, applyOptimistic] = useOptimistic(entries, reducer);
  const [, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  const total = optimisticEntries.reduce((sum, e) => sum + e.amountMl, 0);
  const reached = goalMl > 0 && total >= goalMl;
  const remaining = Math.max(0, goalMl - total);
  const timeFormat = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: timezone });

  const optimisticAdd = (amountMl: number) =>
    applyOptimistic({
      type: "add",
      entry: { id: `pending-${Date.now()}-${Math.random()}`, date, amountMl, loggedAt: new Date().toISOString() },
    });

  const restore = (entry: WaterEntry) => {
    startTransition(async () => {
      applyOptimistic({ type: "add", entry });
      const result = await addWaterAction({ date: entry.date, amountMl: entry.amountMl, loggedAt: entry.loggedAt }).catch(
        () => null,
      );
      if (!result?.ok) toast.error(result?.error.message ?? NETWORK_ERROR.message);
    });
  };

  const remove = (entry: WaterEntry) => {
    startTransition(async () => {
      applyOptimistic({ type: "remove", id: entry.id });
      const result = await deleteWaterAction({ id: entry.id }).catch(() => null);
      if (!result?.ok) {
        toast.error(result?.error.message ?? NETWORK_ERROR.message);
        return;
      }
      undoToast(`${formatMl(entry.amountMl)} Wasser gelöscht.`, { onUndo: () => restore(result.data) });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-5 px-card">
        <div className="flex items-center gap-5">
          <ProgressRing
            value={total}
            max={goalMl}
            label="Wasser"
            valueText={formatWaterProgress(total, goalMl)}
            tone="water"
            track="soft"
            size={104}
            strokeWidth={10}
          >
            <Droplet className="size-7 text-water-strong" aria-hidden="true" />
          </ProgressRing>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-stat-sm text-foreground tabular" aria-live="polite">
              {formatWaterAmount(total)}
            </p>
            <p className="text-body-sm text-muted-foreground tabular">
              {goalMl > 0 ? <>Ziel {formatWaterAmount(goalMl)}</> : "Kein Tagesziel gesetzt"}
            </p>
            <p className="text-body-sm font-medium text-water-strong tabular">
              {reached ? "Wasserziel erreicht." : goalMl > 0 ? `Noch ${formatWaterAmount(remaining)}` : null}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Wasser schnell hinzufügen">
          {WATER_QUICK_AMOUNTS.map((ml) => (
            <AddWaterButton key={ml} date={date} amountMl={ml} onOptimisticAdd={optimisticAdd} size="md" block />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCustomOpen(true)}>
            <Plus aria-hidden="true" />
            Andere Menge
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setGoalOpen(true)}>
            <Pencil aria-hidden="true" />
            Ziel ändern
          </Button>
        </div>
      </Card>

      {optimisticEntries.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<GlassWater />}
          title={isToday ? "Heute noch kein Wasser eingetragen." : "An diesem Tag ist kein Wasser eingetragen."}
          description={isToday ? "Ein Glas zwischendurch? Ein Tipp auf „+ 250 ml“ genügt." : undefined}
        />
      ) : (
        <ListGroup title="Einträge">
          {[...optimisticEntries].reverse().map((entry) => {
            const pending = entry.id.startsWith("pending-");
            return (
              <ListItem
                key={entry.id}
                leading={
                  <ListItemIcon tone="water">
                    <Droplet />
                  </ListItemIcon>
                }
                title={<span className="tabular">{formatMl(entry.amountMl)}</span>}
                description={timeFormat.format(new Date(entry.loggedAt))}
                className={pending ? "opacity-60" : undefined}
                action={
                  <IconButton
                    label={`${formatMl(entry.amountMl)} Wasser löschen`}
                    size="sm"
                    disabled={pending}
                    onClick={() => remove(entry)}
                  >
                    <Trash2 />
                  </IconButton>
                }
              />
            );
          })}
        </ListGroup>
      )}

      <ValueSheet
        open={customOpen}
        onOpenChange={setCustomOpen}
        title="Wasser hinzufügen"
        label="Menge"
        unit="ml"
        initialValue={null}
        min={ACTIVITY_LIMITS.waterMl.min}
        max={ACTIVITY_LIMITS.waterMl.max}
        step={50}
        submitLabel="Hinzufügen"
        onSubmit={(amountMl) => addWaterAction({ date, amountMl })}
        onSuccess={(ml) => toast.success(`${formatMl(ml)} Wasser hinzugefügt.`)}
      />
      <ValueSheet
        open={goalOpen}
        onOpenChange={setGoalOpen}
        title="Wasserziel"
        description="Richtwert für Erwachsene: etwa 1,5 bis 2,5 l am Tag, bei Hitze und Sport mehr."
        label="Tagesziel"
        unit="ml"
        initialValue={goalMl}
        min={ACTIVITY_LIMITS.waterGoalMl.min}
        max={ACTIVITY_LIMITS.waterGoalMl.max}
        step={250}
        submitLabel="Ziel speichern"
        onSubmit={(value) => setWaterGoalAction({ goalMl: value })}
        onSuccess={() => toast.success("Wasserziel gespeichert.")}
      />
    </div>
  );
}
