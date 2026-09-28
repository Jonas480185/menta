"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { ACTIVITY_LEVELS, GOAL_PACES, GOAL_TYPES, type ActivityLevel, type GoalPace, type GoalType } from "@/domain/calories";
import { formatNumber } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { saveProfileAction } from "@/app/(app)/settings/actions";

export interface ProfileFormValues {
  sex: "female" | "male" | "unspecified";
  birthDate: string | null;
  heightCm: number | null;
  targetWeightKg: number | null;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  goalPace: GoalPace | null;
  waterGoalMl: number;
  stepGoal: number;
}

const selectClass = "focus-ring h-11 w-full rounded-control border border-input bg-card px-3 text-body";

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const set = <K extends keyof ProfileFormValues>(k: K, val: ProfileFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const save = useAction(saveProfileAction, {
    onSuccess: (r) => {
      toast.success(`Gespeichert · Erhaltungsbedarf ${formatNumber(r.tdee)} kcal`, {
        description: "Dein Kalorienziel passt du unter „Ziele“ an.",
      });
      router.refresh();
    },
  });

  return (
    <form
      className="space-y-4 rounded-card bg-card p-card shadow-xs"
      onSubmit={(e) => {
        e.preventDefault();
        void save.execute({
          ...v,
          birthDate: v.birthDate ?? undefined,
          heightCm: v.heightCm ?? undefined,
          goalPace: v.goalType === "maintain" ? null : (v.goalPace ?? "moderate"),
        });
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-body-sm font-medium">Geschlecht</span>
        <select className={selectClass} value={v.sex} onChange={(e) => set("sex", e.target.value as ProfileFormValues["sex"])}>
          <option value="female">Weiblich</option>
          <option value="male">Männlich</option>
          <option value="unspecified">Keine Angabe</option>
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-body-sm font-medium">Geburtsdatum</span>
        <input type="date" className={selectClass} value={v.birthDate ?? ""} onChange={(e) => set("birthDate", e.target.value || null)} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-body-sm font-medium">Größe</span>
        <NumberInput value={v.heightCm} onValueChange={(x) => set("heightCm", x)} min={100} max={250} unit="cm" aria-label="Größe" />
      </label>
      <label className="block space-y-1.5">
        <span className="text-body-sm font-medium">Aktivität</span>
        <select className={selectClass} value={v.activityLevel} onChange={(e) => set("activityLevel", e.target.value as ActivityLevel)}>
          {ACTIVITY_LEVELS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-body-sm font-medium">Ziel</span>
        <select className={selectClass} value={v.goalType} onChange={(e) => set("goalType", e.target.value as GoalType)}>
          {GOAL_TYPES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </label>
      {v.goalType !== "maintain" && (
        <>
          <label className="block space-y-1.5">
            <span className="text-body-sm font-medium">Tempo</span>
            <select className={selectClass} value={v.goalPace ?? "moderate"} onChange={(e) => set("goalPace", e.target.value as GoalPace)}>
              {GOAL_PACES.filter((p) => p.goal === v.goalType).map((p) => <option key={p.pace} value={p.pace}>{p.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-body-sm font-medium">Zielgewicht</span>
            <NumberInput value={v.targetWeightKg} onValueChange={(x) => set("targetWeightKg", x)} min={30} max={300} decimals={1} unit="kg" aria-label="Zielgewicht" />
          </label>
        </>
      )}
      <label className="block space-y-1.5">
        <span className="text-body-sm font-medium">Wasserziel</span>
        <NumberInput value={v.waterGoalMl} onValueChange={(x) => set("waterGoalMl", x ?? 2500)} min={500} max={6000} step={250} unit="ml" aria-label="Wasserziel" />
      </label>
      <label className="block space-y-1.5">
        <span className="text-body-sm font-medium">Schrittziel</span>
        <NumberInput value={v.stepGoal} onValueChange={(x) => set("stepGoal", x ?? 8000)} min={0} max={50000} step={500} aria-label="Schrittziel" />
      </label>
      <Button type="submit" block loading={save.isPending}>Speichern</Button>
    </form>
  );
}
