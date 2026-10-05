"use client";

import { Activity as ActivityIcon, Dumbbell, Sparkles, Trash2, Trophy } from "lucide-react";
import { useOptimistic, useTransition } from "react";

import { deleteActivityAction, addActivityAction } from "@/app/(app)/activity/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { ListGroup, ListItem, ListItemIcon } from "@/components/ui/list";
import { toast, undoToast } from "@/components/ui/sonner";
import type { ActivityType } from "@/domain/activity";
import type { IsoDate } from "@/lib/dates";
import { formatKcal, NBSP } from "@/lib/format";
import { NETWORK_ERROR } from "@/lib/use-action";
import type { ActivityEntry } from "@/server/services/activity";

const TYPE_ICON: Record<Exclude<ActivityType, "steps">, React.ComponentType<{ className?: string }>> = {
  cardio: ActivityIcon,
  strength: Dumbbell,
  sport: Trophy,
  other: Sparkles,
};

export interface ActivityListProps {
  date: IsoDate;
  entries: ActivityEntry[];
  isToday: boolean;
}

type OptimisticAction = { type: "add"; entry: ActivityEntry } | { type: "remove"; id: string };

function reducer(list: ActivityEntry[], action: OptimisticAction): ActivityEntry[] {
  return action.type === "add" ? [...list, action.entry] : list.filter((e) => e.id !== action.id);
}

/** Non-steps activities of the day, oldest first, with delete + undo. */
export function ActivityList({ date, entries, isToday }: ActivityListProps) {
  const [optimisticEntries, applyOptimistic] = useOptimistic(entries, reducer);
  const [, startTransition] = useTransition();

  const restore = (entry: ActivityEntry) => {
    startTransition(async () => {
      applyOptimistic({ type: "add", entry });
      const result = await addActivityAction({
        date,
        metKey: entry.metKey,
        name: entry.metKey ? null : entry.name,
        durationMin: entry.durationMin,
        caloriesBurned: entry.caloriesBurned,
        note: entry.note,
      }).catch(() => null);
      if (!result?.ok) toast.error(result?.error.message ?? NETWORK_ERROR.message);
    });
  };

  const remove = (entry: ActivityEntry) => {
    startTransition(async () => {
      applyOptimistic({ type: "remove", id: entry.id });
      const result = await deleteActivityAction({ id: entry.id }).catch(() => null);
      if (!result?.ok) {
        toast.error(result?.error.message ?? NETWORK_ERROR.message);
        return;
      }
      undoToast(`${entry.name} gelöscht.`, { onUndo: () => restore(result.data) });
    });
  };

  if (optimisticEntries.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={<Dumbbell />}
        title={isToday ? "Heute noch keine Aktivität eingetragen." : "An diesem Tag ist keine Aktivität eingetragen."}
        description={isToday ? "Sport, Spaziergang oder Training? Trag es über „Aktivität hinzufügen“ ein." : undefined}
      />
    );
  }

  return (
    <ListGroup title="Aktivitäten">
      {[...optimisticEntries].reverse().map((entry) => {
        const pending = entry.id.startsWith("pending-");
        const Icon = TYPE_ICON[entry.type === "steps" ? "other" : entry.type];
        return (
          <ListItem
            key={entry.id}
            leading={
              <ListItemIcon tone="activity">
                <Icon />
              </ListItemIcon>
            }
            title={entry.name}
            description={entry.note ?? undefined}
            className={pending ? "opacity-60" : undefined}
            trailing={
              <span className="flex flex-col items-end gap-0.5">
                {entry.durationMin != null && <span>{entry.durationMin}{NBSP}min</span>}
                {entry.caloriesBurned != null && entry.caloriesBurned > 0 && (
                  <span className="text-activity-strong">{formatKcal(Math.round(entry.caloriesBurned))}</span>
                )}
              </span>
            }
            action={
              <IconButton
                label={`${entry.name} löschen`}
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
  );
}
