import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps design-system font sizes next to text colours", () => {
    expect(cn("text-body-sm", "text-muted-foreground")).toBe("text-body-sm text-muted-foreground");
    expect(cn("numeric text-display", "text-over-strong").split(" ").sort()).toEqual(
      "text-display numeric text-over-strong".split(" ").sort(),
    );
  });

  it("still dedupes conflicting design-system utilities", () => {
    expect(cn("text-body", "text-caption")).toBe("text-caption");
    expect(cn("rounded-card", "rounded-full")).toBe("rounded-full");
    expect(cn("px-card", "px-4")).toBe("px-4");
    expect(cn("ease-spring", "ease-out")).toBe("ease-out");
  });
});
