import { cn } from "@/lib/utils";

import { fieldClasses } from "./tokens";

/** Multi-line text field that grows with its content (`field-sizing: content`). */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClasses, "field-sizing-content min-h-24 px-3.5 py-2.5", className)}
      {...props}
    />
  );
}

export { Textarea };
