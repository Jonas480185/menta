"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { computeMacroTargets, MACRO_PRESETS, type MacroPercents } from "@/domain/macros";
import { formatNumber } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import { addDayProfileAction, archiveDayProfileAction, saveGoalsAction } from "@/app/(app)/settings/actions";

type Mode = "percent" | "grams" | "auto";
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const KINDS = [
  { value: "training", label: "Trainingstag" },
  { value: "rest", label: "Ruhetag" },
  { value: "high_carb", label: "High Carb" },
  { value: "low_carb", label: "Low Carb" },
  { value: "refeed", label: "Refeed" },
] as const;

export interface GoalsFormProps {
  current: { calorieTarget: number; macroMode: Mode; proteinG: number; carbsG: number; fatG: number; percents: MacroPercents | null } | null;
  calculated: { tdee: number; target: number } | null;
  auto: { weightKg: number; goal: "lose" | "maintain" | "gain"; activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active"; heightCm: number | null; targetWeightKg: number | null } | null;
  dayProfiles: { id: string; name: string; calorieTarget: number; proteinG: number; carbsG: number; fatG: number; weekdays: number[] }[];
}

export function GoalsForm({ current, calculated, auto, dayProfiles }: GoalsFormProps) {
  const router = useRouter();
  const [kcal, setKcal] = useState<number | null>(current?.calorieTarget ?? calculated?.target ?? 2000);
  const [mode, setMode] = useState<Mode>(current?.macroMode ?? "auto");
  const [percents, setPercents] = useState<MacroPercents>(current?.percents ?? { protein: 30, carbs: 40, fat: 30 });
  const [proteinG, setProteinG] = useState<number | null>(current?.proteinG ?? 150);
  const [fatG, setFatG] = useState<number | null>(current?.fatG ?? 70);
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("training");
  const [weekdays, setWeekdays] = useState<number[]>([]);

  const preview = useMemo(() => {
    const k = kcal ?? 0;
    try {
      if (mode === "percent") return computeMacroTargets({ mode, kcal: k, percents });
      if (mode === "grams") return computeMacroTargets({ mode, kcal: k, proteinG: proteinG ?? 0, fatG: fatG ?? 0 });
      if (!auto) return { error: "Für die Empfehlung fehlt dein Gewicht." };
      return computeMacroTargets({ mode, kcal: k, ...auto });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [kcal, mode, percents, proteinG, fatG, auto]);

  const refresh = () => router.refresh();
  const save = useAction(saveGoalsAction, { onSuccess: () => { toast.success("Ziele gespeichert"); refresh(); } });
  const addProfile = useAction(addDayProfileAction, { onSuccess: () => { toast.success("Tagesprofil angelegt"); setWeekdays([]); refresh(); } });
  const archive = useAction(archiveDayProfileAction, { onSuccess: refresh });

  const submit = () => {
    if (!kcal || "error" in preview) return;
    void save.execute({
      calorieTarget: Math.round(kcal),
      calorieSource: calculated && Math.round(kcal) === Math.round(calculated.target) ? "calculated" : "manual",
      macroMode: mode,
      percents: mode === "percent" ? percents : undefined,
      grams: mode === "grams" ? { proteinG: proteinG ?? 0, fatG: fatG ?? 0 } : undefined,
    } as Parameters<typeof saveGoalsAction>[0]);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-card bg-card p-card shadow-xs">
        <h2 className="text-headline">Kalorienziel</h2>
        {calculated && (
          <p className="text-body-sm text-muted-foreground">
            Geschätzter Erhaltungsbedarf: {formatNumber(calculated.tdee)} kcal · empfohlenes Ziel: {formatNumber(calculated.target)} kcal{" "}
            <button type="button" className="text-primary-strong underline" onClick={() => setKcal(Math.round(calculated.target))}>
              übernehmen
            </button>
          </p>
        )}
        <NumberInput value={kcal} onValueChange={setKcal} min={800} max={10000} step={50} unit="kcal" aria-label="Kalorienziel" />
      </section>

      <section className="space-y-3 rounded-card bg-card p-card shadow-xs">
        <h2 className="text-headline">Makros</h2>
        <SegmentedControl<Mode>
          block
          value={mode}
          onValueChange={setMode}
          aria-label="Makro-Modus"
          options={[
            { value: "auto", label: "Empfehlung" },
            { value: "percent", label: "Prozent" },
            { value: "grams", label: "Gramm" },
          ]}
        />
        {mode === "percent" && (
          <>
            <div className="flex flex-wrap gap-2">
              {MACRO_PRESETS.map((p) => (
                <Button key={p.id} size="sm" variant="secondary" onClick={() => setPercents(p.percents)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["protein", "carbs", "fat"] as const).map((k) => (
                <NumberInput key={k} aria-label={k} value={percents[k]} onValueChange={(v) => setPercents((p) => ({ ...p, [k]: v ?? 0 }))} min={0} max={100} unit="%" />
              ))}
            </div>
          </>
        )}
        {mode === "grams" && (
          <div className="grid grid-cols-2 gap-2">
            <NumberInput aria-label="Protein (g)" value={proteinG} onValueChange={setProteinG} min={0} max={500} unit="g P" />
            <NumberInput aria-label="Fett (g)" value={fatG} onValueChange={setFatG} min={0} max={300} unit="g F" />
          </div>
        )}
        {"error" in preview ? (
          <p className="text-body-sm text-destructive-strong">{preview.error}</p>
        ) : (
          <p className="tabular text-body-sm text-muted-foreground">
            Protein {formatNumber(preview.macros.proteinG)} g · Kohlenhydrate {formatNumber(preview.macros.carbsG)} g · Fett{" "}
            {formatNumber(preview.macros.fatG)} g = {formatNumber(preview.macroKcal)} kcal
          </p>
        )}
        <Button block onClick={submit} loading={save.isPending} disabled={"error" in preview}>
          Ziele speichern
        </Button>
      </section>

      <section className="space-y-3 rounded-card bg-card p-card shadow-xs">
        <h2 className="text-headline">Tagesprofile</h2>
        <p className="text-body-sm text-muted-foreground">
          Andere Ziele an bestimmten Wochentagen, z. B. mehr Kohlenhydrate an Trainingstagen.
        </p>
        <ul className="space-y-2">
          {dayProfiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-control bg-muted px-3 py-2">
              <div>
                <div className="text-body font-medium">{p.name}</div>
                <div className="tabular text-body-sm text-muted-foreground">
                  {formatNumber(p.calorieTarget)} kcal · {p.weekdays.map((d) => WEEKDAYS[d - 1]).join(", ") || "kein Wochentag"}
                </div>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`${p.name} entfernen`} onClick={() => archive.execute(p.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <SegmentedControl block size="sm" value={kind} onValueChange={setKind} aria-label="Profiltyp" options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
        <div className="flex gap-1.5" role="group" aria-label="Wochentage">
          {WEEKDAYS.map((d, i) => {
            const on = weekdays.includes(i + 1);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== i + 1) : [...w, i + 1]))}
                className={cn("focus-ring h-10 flex-1 rounded-control text-body-sm", on ? "bg-primary text-primary-foreground" : "bg-muted")}
              >
                {d}
              </button>
            );
          })}
        </div>
        <Button variant="soft" block loading={addProfile.isPending} onClick={() => addProfile.execute({ kind, weekdays })}>
          Tagesprofil hinzufügen
        </Button>
      </section>
    </div>
  );
}
