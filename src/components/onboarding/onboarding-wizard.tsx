"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { type MiloMood } from "@/components/mascot/milo";
import { MiloBuddy } from "@/components/mascot/milo-buddy";
import {
  ACTIVITY_LEVELS,
  GOAL_PACES,
  GOAL_TYPES,
  calculateAge,
  calculateCalories,
  type ActivityLevel,
  type GoalPace,
  type GoalType,
} from "@/domain/calories";
import { computeMacroTargets, MACRO_PRESETS, type MacroPercents } from "@/domain/macros";
import { formatNumber, formatSignedKcal } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import { completeOnboardingAction } from "@/app/onboarding/actions";

type Sex = "female" | "male" | "unspecified";
const STEPS = ["welcome", "goal", "body", "activity", "weightGoal", "calories", "macros", "review"] as const;
type Step = (typeof STEPS)[number];

const MOOD: Record<Step, MiloMood> = {
  welcome: "happy",
  goal: "thinking",
  body: "neutral",
  activity: "encouraging",
  weightGoal: "thinking",
  calories: "thinking",
  macros: "neutral",
  review: "goal_reached",
};

function Choice({ selected, onClick, title, description }: { selected: boolean; onClick: () => void; title: string; description?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "focus-ring w-full rounded-card border p-4 text-left transition-colors",
        selected ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-accent",
      )}
    >
      <div className="text-body font-medium">{title}</div>
      {description && <div className="text-body-sm text-muted-foreground">{description}</div>}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-body-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function OnboardingWizard({ today }: { today: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [goalType, setGoalType] = useState<GoalType>("lose");
  const [pace, setPace] = useState<GoalPace>("moderate");
  const [sex, setSex] = useState<Sex>("unspecified");
  const [birthDate, setBirthDate] = useState("1995-01-01");
  const [heightCm, setHeight] = useState<number | null>(175);
  const [weightKg, setWeight] = useState<number | null>(80);
  const [targetKg, setTarget] = useState<number | null>(75);
  const [activity, setActivity] = useState<ActivityLevel>("light");
  const [manualKcal, setManualKcal] = useState<number | null>(null);
  const [macroMode, setMacroMode] = useState<"auto" | "percent" | "grams">("auto");
  const [percents, setPercents] = useState<MacroPercents>({ protein: 30, carbs: 40, fat: 30 });
  const [grams, setGrams] = useState<{ proteinG: number | null; fatG: number | null }>({ proteinG: 150, fatG: 70 });

  const age = useMemo(() => {
    try {
      return calculateAge(birthDate, today);
    } catch {
      return null;
    }
  }, [birthDate, today]);

  const calc = useMemo(() => {
    if (!age || !heightCm || !weightKg) return null;
    try {
      return calculateCalories(
        { ageYears: age, sex, heightCm, weightKg, activityLevel: activity },
        { type: goalType, pace: goalType === "maintain" ? null : pace, targetWeightKg: targetKg },
      );
    } catch {
      return null;
    }
  }, [age, sex, heightCm, weightKg, activity, goalType, pace, targetKg]);

  const kcal = manualKcal ?? (calc ? Math.round(calc.target) : 2000);
  const macros = useMemo(() => {
    try {
      if (macroMode === "percent") return computeMacroTargets({ mode: "percent", kcal, percents });
      if (macroMode === "grams")
        return computeMacroTargets({ mode: "grams", kcal, proteinG: grams.proteinG ?? 0, fatG: grams.fatG ?? 0 });
      return computeMacroTargets({ mode: "auto", kcal, weightKg: weightKg ?? 70, targetWeightKg: targetKg, heightCm, goal: goalType, activityLevel: activity });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [macroMode, kcal, percents, grams, weightKg, targetKg, heightCm, goalType, activity]);

  const finish = useAction(completeOnboardingAction, {
    onSuccess: () => {
      router.replace("/today");
      router.refresh();
    },
  });

  const i = STEPS.indexOf(step);
  const next = () => {
    let n = STEPS[i + 1];
    if (n === "weightGoal" && goalType === "maintain") n = "calories";
    setStep(n);
  };
  const back = () => {
    let p = STEPS[i - 1];
    if (p === "weightGoal" && goalType === "maintain") p = "activity";
    setStep(p);
  };
  const canNext =
    (step !== "body" || (age != null && age >= 14 && !!heightCm && !!weightKg)) &&
    (step !== "macros" || !("error" in macros)) &&
    (step !== "weightGoal" || !!targetKg);

  const submit = () => {
    if ("error" in macros || !weightKg || !heightCm) return;
    void finish.execute({
      sex,
      birthDate,
      heightCm,
      weightKg,
      targetWeightKg: goalType === "maintain" ? null : targetKg,
      activityLevel: activity,
      goalType,
      goalPace: goalType === "maintain" ? null : pace,
      calorieTarget: kcal,
      calorieSource: manualKcal != null ? "manual" : "calculated",
      macroMode,
      percents: macroMode === "percent" ? percents : undefined,
      grams: macroMode === "grams" ? { proteinG: grams.proteinG ?? 0, fatG: grams.fatG ?? 0 } : undefined,
    });
  };

  const m = "error" in macros ? null : macros.macros;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6 flex items-center gap-3">
        {i > 0 && (
          <Button variant="ghost" size="icon-sm" aria-label="Zurück" onClick={back}>
            <ArrowLeft />
          </Button>
        )}
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" role="progressbar" aria-valuenow={i + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label="Fortschritt">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5">
        <MiloBuddy key={step} mood={MOOD[step]} size={step === "welcome" ? 128 : 72} className={step === "welcome" ? "mx-auto mt-8" : ""} />

        {step === "welcome" && (
          <div className="space-y-3 text-center">
            <h1 className="text-display">Willkommen bei Menta</h1>
            <p className="text-body text-muted-foreground">
              Ich bin Milo. In ein paar Schritten berechnen wir dein persönliches Kalorien- und Makroziel. Alles bleibt jederzeit änderbar.
            </p>
          </div>
        )}

        {step === "goal" && (
          <div role="radiogroup" aria-label="Ziel" className="space-y-3">
            <h1 className="text-title">Was ist dein Ziel?</h1>
            {GOAL_TYPES.map((g) => (
              <Choice key={g.id} selected={goalType === g.id} onClick={() => setGoalType(g.id)} title={g.label} description={g.description} />
            ))}
          </div>
        )}

        {step === "body" && (
          <div className="space-y-4">
            <h1 className="text-title">Ein paar Eckdaten</h1>
            <Field label="Geschlecht (optional, für eine genauere Schätzung)">
              <SegmentedControl<Sex>
                block
                value={sex}
                onValueChange={setSex}
                aria-label="Geschlecht"
                options={[
                  { value: "female", label: "Weiblich" },
                  { value: "male", label: "Männlich" },
                  { value: "unspecified", label: "Keine Angabe" },
                ]}
              />
            </Field>
            <Field label="Geburtsdatum">
              <input
                type="date"
                value={birthDate}
                max={today}
                onChange={(e) => setBirthDate(e.target.value)}
                className="focus-ring h-11 w-full rounded-control border border-input bg-card px-3.5 text-body"
              />
            </Field>
            <Field label="Größe">
              <NumberInput value={heightCm} onValueChange={setHeight} min={100} max={250} unit="cm" aria-label="Größe" />
            </Field>
            <Field label="Aktuelles Gewicht">
              <NumberInput value={weightKg} onValueChange={setWeight} min={30} max={300} decimals={1} step={0.1} unit="kg" aria-label="Gewicht" />
            </Field>
          </div>
        )}

        {step === "activity" && (
          <div role="radiogroup" aria-label="Aktivität" className="space-y-3">
            <h1 className="text-title">Wie aktiv ist dein Alltag?</h1>
            {ACTIVITY_LEVELS.map((a) => (
              <Choice key={a.id} selected={activity === a.id} onClick={() => setActivity(a.id)} title={a.label} description={a.description} />
            ))}
          </div>
        )}

        {step === "weightGoal" && (
          <div className="space-y-4">
            <h1 className="text-title">Zielgewicht & Tempo</h1>
            <Field label="Zielgewicht">
              <NumberInput value={targetKg} onValueChange={setTarget} min={30} max={300} decimals={1} step={0.5} unit="kg" aria-label="Zielgewicht" />
            </Field>
            <div role="radiogroup" aria-label="Tempo" className="space-y-3">
              {GOAL_PACES.filter((p) => p.goal === goalType).map((p) => (
                <Choice key={p.pace} selected={pace === p.pace} onClick={() => setPace(p.pace)} title={p.label} />
              ))}
            </div>
          </div>
        )}

        {step === "calories" && (
          <div className="space-y-4">
            <h1 className="text-title">Dein Kalorienziel</h1>
            {calc && (
              <dl className="space-y-2 rounded-card bg-card p-card shadow-xs">
                <div className="flex justify-between"><dt className="text-muted-foreground">Grundumsatz</dt><dd className="tabular">{formatNumber(calc.bmr)} kcal</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Geschätzter Erhaltungsbedarf</dt><dd className="tabular">{formatNumber(calc.tdee)} kcal</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{calc.adjustment < 0 ? "Gewähltes Defizit" : "Anpassung"}</dt><dd className="tabular">{formatSignedKcal(calc.adjustment)}</dd></div>
                <div className="flex justify-between border-t border-border pt-2 text-headline"><dt>Tagesziel</dt><dd className="tabular">{formatNumber(calc.target)} kcal</dd></div>
                {calc.warnings.map((w) => <p key={w} className="text-body-sm text-warning-strong">{w}</p>)}
              </dl>
            )}
            <Field label="Eigenes Ziel (optional überschreiben)">
              <NumberInput value={manualKcal} onValueChange={setManualKcal} min={800} max={10000} step={50} unit="kcal" aria-label="Eigenes Kalorienziel" placeholder={calc ? String(Math.round(calc.target)) : "2000"} />
            </Field>
          </div>
        )}

        {step === "macros" && (
          <div className="space-y-4">
            <h1 className="text-title">Makros</h1>
            <SegmentedControl<"auto" | "percent" | "grams">
              block
              value={macroMode}
              onValueChange={setMacroMode}
              aria-label="Makro-Modus"
              options={[
                { value: "auto", label: "Empfehlung" },
                { value: "percent", label: "Prozent" },
                { value: "grams", label: "Gramm" },
              ]}
            />
            {macroMode === "percent" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {MACRO_PRESETS.map((p) => (
                    <Button key={p.id} size="sm" variant="secondary" onClick={() => setPercents(p.percents)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
                {(["protein", "carbs", "fat"] as const).map((k) => (
                  <Field key={k} label={{ protein: "Protein", carbs: "Kohlenhydrate", fat: "Fett" }[k]}>
                    <NumberInput value={percents[k]} onValueChange={(v) => setPercents((p) => ({ ...p, [k]: v ?? 0 }))} min={0} max={100} unit="%" aria-label={k} />
                  </Field>
                ))}
                <p className="text-body-sm text-muted-foreground">Summe: {percents.protein + percents.carbs + percents.fat} %</p>
              </div>
            )}
            {macroMode === "grams" && (
              <div className="space-y-3">
                <Field label="Protein">
                  <NumberInput value={grams.proteinG} onValueChange={(v) => setGrams((g) => ({ ...g, proteinG: v }))} min={0} max={500} unit="g" aria-label="Protein in Gramm" />
                </Field>
                <Field label="Fett">
                  <NumberInput value={grams.fatG} onValueChange={(v) => setGrams((g) => ({ ...g, fatG: v }))} min={0} max={300} unit="g" aria-label="Fett in Gramm" />
                </Field>
                <p className="text-body-sm text-muted-foreground">Kohlenhydrate werden automatisch aus den restlichen Kalorien berechnet.</p>
              </div>
            )}
            {"error" in macros ? (
              <p className="text-body-sm text-destructive-strong">{macros.error}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 rounded-card bg-card p-4 text-center shadow-xs">
                {([["Protein", m!.proteinG, "text-protein-strong"], ["Kohlenh.", m!.carbsG, "text-carbs-strong"], ["Fett", m!.fatG, "text-fat-strong"]] as const).map(([l, v, c]) => (
                  <div key={l}>
                    <div className={cn("tabular text-stat-sm", c)}>{formatNumber(v)} g</div>
                    <div className="text-caption text-muted-foreground">{l}</div>
                  </div>
                ))}
                <p className="col-span-3 mt-2 text-body-sm text-muted-foreground">
                  = {formatNumber(macros.macroKcal)} kcal (4/4/9 kcal pro g)
                </p>
              </div>
            )}
          </div>
        )}

        {step === "review" && m && (
          <div className="space-y-4">
            <h1 className="text-title">Dein Plan</h1>
            <dl className="space-y-2 rounded-card bg-card p-card shadow-xs">
              {calc && <div className="flex justify-between"><dt className="text-muted-foreground">Geschätzter Erhaltungsbedarf</dt><dd className="tabular">{formatNumber(calc.tdee)} kcal</dd></div>}
              <div className="flex justify-between text-headline"><dt>Dein Ziel</dt><dd className="tabular">{formatNumber(kcal)} kcal</dd></div>
              <div className="flex justify-between"><dt className="text-protein-strong">Protein</dt><dd className="tabular">{formatNumber(m.proteinG)} g</dd></div>
              <div className="flex justify-between"><dt className="text-carbs-strong">Kohlenhydrate</dt><dd className="tabular">{formatNumber(m.carbsG)} g</dd></div>
              <div className="flex justify-between"><dt className="text-fat-strong">Fett</dt><dd className="tabular">{formatNumber(m.fatG)} g</dd></div>
            </dl>
            <p className="text-body-sm text-muted-foreground">Du kannst alle Werte später unter Profil → Ziele anpassen.</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-6 bg-background pt-3 pb-safe">
        {step === "review" ? (
          <Button block size="lg" onClick={submit} loading={finish.isPending}>
            Los geht&apos;s
          </Button>
        ) : (
          <Button block size="lg" onClick={next} disabled={!canNext}>
            {step === "welcome" ? "Starten" : "Weiter"}
          </Button>
        )}
      </div>
    </div>
  );
}
