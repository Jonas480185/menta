import { useId } from "react";

import { cn } from "@/lib/utils";

export interface SectionProps extends Omit<React.ComponentProps<"section">, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right side of the heading row, e.g. a "Alle anzeigen" link. */
  action?: React.ReactNode;
  /** Heading level for the title (default h2). */
  as?: "h2" | "h3";
}

/** Vertical content group with an optional heading row. Spacing rhythm: 12 px head → body. */
function Section({ title, description, action, as: Heading = "h2", className, children, ...props }: SectionProps) {
  const headingId = useId();
  return (
    <section
      data-slot="section"
      aria-labelledby={title ? headingId : undefined}
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title && (
              <Heading id={headingId} className="text-lg leading-snug font-semibold tracking-tight text-foreground">
                {title}
              </Heading>
            )}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export { Section };
