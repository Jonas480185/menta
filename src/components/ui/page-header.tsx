import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { focusRing } from "./tokens";

export interface PageHeaderProps extends Omit<React.ComponentProps<"header">, "title"> {
  title: React.ReactNode;
  /** Small line above the title (e.g. a date "Donnerstag, 25. Sep."). */
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned actions (IconButtons, Buttons). */
  actions?: React.ReactNode;
  /** Back link rendered above the title. */
  back?: { href: string; label?: string };
}

/** Top of every screen: optional back link, eyebrow, H1 title, subtitle and actions. */
function PageHeader({ title, eyebrow, subtitle, actions, back, className, ...props }: PageHeaderProps) {
  return (
    <header data-slot="page-header" className={cn("flex flex-col gap-2 pt-2 pb-4", className)} {...props}>
      {back && (
        <Link
          href={back.href}
          className={cn(
            "-ml-2 inline-flex h-11 w-fit items-center gap-0.5 rounded-control pr-3 pl-1 text-body-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            focusRing,
          )}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
          {back.label ?? "Zurück"}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow && <p className="text-body-sm font-medium text-muted-foreground">{eyebrow}</p>}
          <h1 className="text-title text-balance text-foreground">{title}</h1>
          {subtitle && <p className="text-body text-pretty text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export { PageHeader };
