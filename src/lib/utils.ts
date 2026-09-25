import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must know the design system's custom scales (src/app/globals.css),
 * otherwise it treats e.g. `text-body-sm` as a text *colour* and drops it when merged
 * with `text-muted-foreground`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display",
        "title",
        "heading",
        "headline",
        "body",
        "body-sm",
        "caption",
        "overline",
        "stat",
        "stat-sm",
      ],
      radius: ["control", "card", "sheet"],
      spacing: ["gutter", "card", "section", "header", "bottom-nav"],
      ease: ["spring", "emphasized"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
