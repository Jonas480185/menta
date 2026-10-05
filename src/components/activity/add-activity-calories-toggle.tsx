"use client";

import { useId } from "react";

import { setAddActivityCaloriesAction } from "@/app/(app)/activity/actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/lib/use-action";

export interface AddActivityCaloriesToggleProps {
  enabled: boolean;
  className?: string;
}

/** "Aktivitätskalorien zum Tagesbudget addieren": toggles user_profiles.add_activity_calories. */
export function AddActivityCaloriesToggle({ enabled, className }: AddActivityCaloriesToggleProps) {
  const id = useId();
  const { execute, isPending } = useAction(setAddActivityCaloriesAction, {
    successMessage: ({ enabled: next }) => (next ? "Aktivitätskalorien werden addiert." : "Aktivitätskalorien werden nicht mehr addiert."),
  });

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={id} className="text-body font-medium text-foreground">
          Aktivitätskalorien zum Tagesbudget addieren
        </Label>
        <Switch
          id={id}
          checked={enabled}
          disabled={isPending}
          onCheckedChange={(checked) => void execute({ enabled: checked })}
        />
      </div>
      <p className="mt-1 text-body-sm text-muted-foreground">
        Verbrannte Kalorien aus eingetragenen Aktivitäten erhöhen dann dein Kalorienziel für den Tag. Schritte
        zählen nicht dazu, sie stecken schon in deinem Aktivitätslevel.
      </p>
    </div>
  );
}
