import { cn } from "@/lib/utils";

/** Shimmering placeholder that reserves layout while data loads (prevents CLS). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
