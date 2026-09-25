import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { cn } from "@/lib/utils";

import { cardSurface, focusRingInset, toneSoft, toneStrong, type Tone } from "./tokens";

export interface ListGroupProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Small heading above the group ("Allgemein", "Zuletzt verwendet"). */
  title?: React.ReactNode;
  /** Explanatory text below the group. */
  footer?: React.ReactNode;
}

/** iOS-style grouped list: rounded card with hairline separators. Children: `ListItem`s. */
function ListGroup({ title, footer, className, children, ...props }: ListGroupProps) {
  const titleId = useId();
  return (
    <div data-slot="list-group" className={cn("flex flex-col gap-2", className)} {...props}>
      {title && (
        <h3 id={titleId} className="px-4 text-overline text-muted-foreground uppercase">
          {title}
        </h3>
      )}
      <ul
        aria-labelledby={title ? titleId : undefined}
        className={cn(cardSurface, "divide-y divide-border overflow-hidden")}
      >
        {children}
      </ul>
      {footer && <p className="px-4 text-caption text-muted-foreground">{footer}</p>}
    </div>
  );
}

interface ListItemBaseProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Leading visual – typically `<ListItemIcon>`, an Avatar or a food thumbnail. */
  leading?: React.ReactNode;
  /** Trailing value text or control (value, Badge, Switch, MacroChips). */
  trailing?: React.ReactNode;
  /** Show a disclosure chevron (defaults to true for links). */
  chevron?: boolean;
  /** Separate trailing action button (e.g. quick-add "+") placed outside the main tap target. */
  action?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
}

export type ListItemProps = ListItemBaseProps &
  (
    | { href: string; onClick?: never; prefetch?: boolean }
    | { href?: never; onClick?: React.MouseEventHandler<HTMLButtonElement>; prefetch?: never }
  );

const rowClasses =
  "flex min-h-14 w-full min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left outline-none";
const interactiveClasses = cn(
  "cursor-pointer transition-colors duration-150 hover:bg-accent active:bg-muted disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  focusRingInset,
);

/** Row inside a `ListGroup`. Renders a link (`href`), a button (`onClick`) or static content. */
function ListItem(props: ListItemProps) {
  const { title, description, leading, trailing, chevron, action, destructive, disabled, className } = props;
  const showChevron = chevron ?? props.href !== undefined;

  const content = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "truncate text-body font-medium",
            destructive ? "text-destructive" : "text-foreground",
          )}
        >
          {title}
        </span>
        {description && (
          <span className="line-clamp-2 text-body-sm text-muted-foreground">{description}</span>
        )}
      </span>
      {trailing && (
        <span className="flex shrink-0 items-center gap-2 text-body-sm text-muted-foreground tabular">
          {trailing}
        </span>
      )}
      {showChevron && (
        <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      )}
    </>
  );

  let main: React.ReactNode;
  if (props.href !== undefined) {
    main = (
      <Link
        href={props.href}
        prefetch={props.prefetch}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        className={cn(rowClasses, interactiveClasses)}
      >
        {content}
      </Link>
    );
  } else if (props.onClick) {
    main = (
      <button
        type="button"
        onClick={props.onClick}
        disabled={disabled}
        className={cn(rowClasses, interactiveClasses)}
      >
        {content}
      </button>
    );
  } else {
    main = <div className={cn(rowClasses, disabled && "opacity-50")}>{content}</div>;
  }

  return (
    <li data-slot="list-item" className={cn("flex items-center", className)}>
      {main}
      {action && <span className="flex shrink-0 items-center pr-2">{action}</span>}
    </li>
  );
}

export interface ListItemIconProps extends React.ComponentProps<"span"> {
  tone?: Tone;
}

/** Tinted rounded icon well for list rows. */
function ListItemIcon({ tone = "primary", className, ...props }: ListItemIconProps) {
  return (
    <span
      data-slot="list-item-icon"
      aria-hidden="true"
      className={cn(
        "flex size-9 items-center justify-center rounded-sm [&_svg:not([class*='size-'])]:size-5",
        toneSoft[tone],
        toneStrong[tone],
        className,
      )}
      {...props}
    />
  );
}

export { ListGroup, ListItem, ListItemIcon };
