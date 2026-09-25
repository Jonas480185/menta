import { describe, expect, it } from "vitest";
import { z } from "./zod";

describe("zod locale", () => {
  it("uses German default messages", () => {
    const res = z.string().min(3).safeParse("a");
    expect(res.success).toBe(false);
    expect(res.error?.issues[0].message).toMatch(/Zu klein|zu kurz|mindestens/i);
  });
});
