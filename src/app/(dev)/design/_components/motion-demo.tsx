"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Literal class names so Tailwind generates them. */
const SAMPLES = [
  { label: "fast · 150 ms · ease-out", className: "duration-(--duration-fast) ease-out" },
  { label: "base · 200 ms · ease-out", className: "duration-(--duration-base) ease-out" },
  { label: "slow · 300 ms · ease-in-out", className: "duration-(--duration-slow) ease-in-out" },
  { label: "spring · 550 ms · ease-spring", className: "duration-(--duration-spring) ease-spring" },
] as const;

export function MotionDemo() {
  const [on, setOn] = useState(false);
  return (
    <div className="bg-card rounded-card p-card grid gap-4 shadow-sm dark:border">
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        className="bg-primary text-primary-foreground inline-flex min-h-11 w-fit items-center gap-2 rounded-md px-4 text-body-sm font-semibold transition-[filter] hover:brightness-95 active:brightness-90"
      >
        <Play aria-hidden className="size-4" strokeWidth={1.75} />
        Abspielen
      </button>
      {SAMPLES.map((s) => (
        <div key={s.label} className="grid gap-1.5">
          <span className="text-muted-foreground font-mono text-caption">{s.label}</span>
          <div className="bg-surface-inset relative h-8 rounded-full">
            <span
              className={cn(
                "bg-brand absolute top-1 left-1 size-6 rounded-full transition-transform",
                s.className,
                on && "translate-x-[calc(min(22rem,70vw)-2rem)]",
              )}
            />
          </div>
        </div>
      ))}
      <p className="text-muted-foreground text-body-sm">
        Mit „Bewegung reduzieren“ im System springen alle Punkte ohne Animation.
      </p>
    </div>
  );
}
