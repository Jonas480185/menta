import Link from "next/link";
import { ChefHat, Droplets, ScanBarcode, Scale, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS: readonly { href: string; label: string; icon: LucideIcon; cls: string }[] = [
  { href: "/scan", label: "Scannen", icon: ScanBarcode, cls: "bg-primary-soft text-primary-strong" },
  { href: "/activity", label: "Wasser", icon: Droplets, cls: "bg-water-soft text-water-strong" },
  { href: "/progress/weight", label: "Gewicht", icon: Scale, cls: "bg-weight-soft text-weight-strong" },
  { href: "/recipes", label: "Rezepte", icon: ChefHat, cls: "bg-carbs-soft text-carbs-strong" },
];

/** Shortcut row (MyFitnessPal / Lose It pattern) for the most frequent secondary jobs. */
export function QuickActions({ className }: { className?: string }) {
  return (
    <nav aria-label="Schnellzugriff" className={cn("grid grid-cols-4 gap-2", className)}>
      {ACTIONS.map(({ href, label, icon: Icon, cls }) => (
        <Link
          key={href}
          href={href}
          className="focus-ring group flex min-h-11 flex-col items-center gap-1.5 rounded-2xl py-1 text-caption text-foreground"
        >
          <span
            aria-hidden
            className={cn(
              "flex size-13 items-center justify-center rounded-2xl transition-transform duration-150 group-hover:-translate-y-0.5 group-active:scale-90",
              cls,
            )}
          >
            <Icon className="size-6" />
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
