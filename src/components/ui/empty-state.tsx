import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Lucide icon shown in a soft circle. Ignored when `illustration` is set. */
  icon?: React.ReactNode;
  /** Larger visual, e.g. `<Milo mood="curious" />`. */
  illustration?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary call to action (Button). */
  action?: React.ReactNode;
  /** Optional secondary action (ghost Button / link). */
  secondaryAction?: React.ReactNode;
  size?: "sm" | "md";
}

/** Friendly, encouraging placeholder for lists and screens without data yet. */
function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "md" ? "gap-4 px-6 py-12" : "gap-3 px-4 py-8",
        className,
      )}
      {...props}
    >
      {illustration ? (
        <div className="flex items-center justify-center" aria-hidden="true">
          {illustration}
        </div>
      ) : icon ? (
        <div
          aria-hidden="true"
          className={cn(
            "flex items-center justify-center rounded-full bg-primary-soft text-primary-strong",
            size === "md"
              ? "size-14 [&_svg:not([class*='size-'])]:size-7"
              : "size-11 [&_svg:not([class*='size-'])]:size-5",
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="flex max-w-sm flex-col gap-1.5">
        <p className={cn("text-balance text-foreground", size === "md" ? "text-heading" : "text-headline")}>
          {title}
        </p>
        {description && <p className="text-body-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {(action || secondaryAction) && (
        <div className="flex w-full max-w-xs flex-col items-stretch gap-2 sm:w-auto sm:max-w-none sm:flex-row sm:items-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export { EmptyState };
