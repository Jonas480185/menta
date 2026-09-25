import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "@/test/db";
import { meals } from "@/server/db/schema";
import type { Db } from "@/server/db/create";
import { AppError } from "@/lib/errors";
import { inTransaction } from "./context";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

describe("inTransaction", () => {
  it("commits on success", async () => {
    const ctx = await createTestUser(db);
    await inTransaction(ctx, async (tx) => {
      await tx.db.update(meals).set({ name: "Zmorge" }).where(eq(meals.id, ctx.mealIds.breakfast));
    });
    const [row] = await db.select().from(meals).where(eq(meals.id, ctx.mealIds.breakfast));
    expect(row.name).toBe("Zmorge");
  });

  it("rolls back when the callback throws", async () => {
    const ctx = await createTestUser(db);
    await expect(
      inTransaction(ctx, async (tx) => {
        await tx.db.update(meals).set({ name: "Weg" }).where(eq(meals.id, ctx.mealIds.lunch));
        throw new AppError("CONFLICT", "nope");
      }),
    ).rejects.toThrow("nope");
    const [row] = await db.select().from(meals).where(eq(meals.id, ctx.mealIds.lunch));
    expect(row.name).toBe("Mittagessen");
  });

  it("keeps userId/timezone and supports nesting (savepoints)", async () => {
    const ctx = await createTestUser(db);
    await inTransaction(ctx, async (outer) => {
      expect(outer.userId).toBe(ctx.userId);
      await inTransaction(outer, async (inner) => {
        expect(inner.timezone).toBe(ctx.timezone);
      });
    });
  });
});
