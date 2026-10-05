import { Apple, Coffee, Moon, Soup, Utensils, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const RULES: readonly { re: RegExp; icon: LucideIcon; cls: string }[] = [
  { re: /früh|breakfast|morgen/i, icon: Coffee, cls: "bg-kcal-soft text-kcal-strong" },
  { re: /mittag|lunch/i, icon: Soup, cls: "bg-carbs-soft text-carbs-strong" },
  { re: /abend|dinner/i, icon: Moon, cls: "bg-protein-soft text-protein-strong" },
  { re: /snack|zwischen/i, icon: Apple, cls: "bg-fat-soft text-fat-strong" },
];

/** Coloured icon tile for a meal slot, derived from its (user-editable) name. */
export function MealIcon({ name, className }: { name: string; className?: string }) {
  const rule = RULES.find((r) => r.re.test(name));
  const Icon = rule?.icon ?? Utensils;
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-2xl",
        rule?.cls ?? "bg-primary-soft text-primary-strong",
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}
