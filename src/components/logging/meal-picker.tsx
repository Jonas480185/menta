"use client";

import { cn } from "@/lib/utils";

export interface MealOption {
  id: string;
  name: string;
}

/** Horizontal chip selector for meal slots. */
export function MealPicker({
  meals,
  value,
  onChange,
}: {
  meals: MealOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Mahlzeit" className="scrollbar-none -mx-gutter flex gap-2 overflow-x-auto px-gutter">
      {meals.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={m.id === value}
          onClick={() => onChange(m.id)}
          className={cn(
            "focus-ring h-10 shrink-0 rounded-full border px-4 text-body-sm transition-colors",
            m.id === value
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-accent",
          )}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
}
