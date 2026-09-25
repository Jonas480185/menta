import { beforeAll, describe, expect, it, vi } from "vitest";
import { notFound as nextNotFound, redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { createTestDb } from "@/test/db";
import type { Db } from "@/server/db/create";
import { AppError, conflict, isAppError, notFound, validationError } from "./errors";
import { logger } from "./logger";
import {
  fail,
  isNextControlFlowError,
  ok,
  runAction,
  toErrorResponse,
  toErrorResult,
  unwrap,
  zodFieldErrors,
} from "./result";

function catchSync(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected throw");
}

describe("toErrorResult", () => {
  it("maps AppError to its code, message and fieldErrors", () => {
    expect(toErrorResult(notFound("Lebensmittel"))).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Lebensmittel nicht gefunden." },
    });
    expect(toErrorResult(validationError({ grams: ["Zu groß"] }))).toEqual({
      ok: false,
      error: { code: "VALIDATION", message: "Bitte Eingaben prüfen.", fieldErrors: { grams: ["Zu groß"] } },
    });
  });

  it("recognizes structurally identical AppErrors from another module instance", () => {
    const foreign = Object.assign(new Error("Nope"), { name: "AppError", code: "FORBIDDEN" });
    expect(isAppError(foreign)).toBe(true);
    expect(toErrorResult(foreign)).toEqual({ ok: false, error: { code: "FORBIDDEN", message: "Nope" } });
  });

  it("maps ZodError to VALIDATION with dotted field paths", () => {
    const schema = z.object({
      grams: z.number().positive("Menge muss größer als 0 sein"),
      servings: z.array(z.object({ label: z.string().min(1, "Pflichtfeld") })),
    });
    const parsed = schema.safeParse({ grams: -1, servings: [{ label: "" }] });
    expect(parsed.success).toBe(false);
    expect(toErrorResult(parsed.error)).toEqual({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Bitte Eingaben prüfen.",
        fieldErrors: { grams: ["Menge muss größer als 0 sein"], "servings.0.label": ["Pflichtfeld"] },
      },
    });
  });

  it("puts path-less Zod issues under '_'", () => {
    const schema = z
      .object({ a: z.number(), b: z.number() })
      .refine((v) => v.a < v.b, "a muss kleiner als b sein");
    const parsed = schema.safeParse({ a: 2, b: 1 });
    expect(zodFieldErrors(parsed.error!)).toEqual({ _: ["a muss kleiner als b sein"] });
  });

  it("maps unknown errors to INTERNAL without leaking details and logs them", () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    // `logger` is the root instance; toErrorResult logs via it.
    const result = toErrorResult(new Error("connection refused at 10.0.0.1"));
    expect(result).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "Etwas ist schiefgelaufen. Bitte erneut versuchen." },
    });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("handles non-Error throwables", () => {
    vi.spyOn(logger, "error").mockImplementation(() => {});
    expect(toErrorResult("string")).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect(toErrorResult(undefined)).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    vi.restoreAllMocks();
  });
});

describe("Postgres constraint errors (real PGlite)", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
    await db.execute(sql`create table parent (id int primary key)`);
    await db.execute(sql`create table child (id int primary key, parent_id int references parent(id))`);
    await db.execute(sql`insert into parent values (1)`);
  });

  async function thrown(query: ReturnType<typeof sql>) {
    try {
      await db.execute(query);
    } catch (err) {
      return err;
    }
    throw new Error("expected query to fail");
  }

  it("unique violation → CONFLICT", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(toErrorResult(await thrown(sql`insert into parent values (1)`))).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
    vi.restoreAllMocks();
  });

  it("foreign key violation → VALIDATION", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(toErrorResult(await thrown(sql`insert into child values (1, 999)`))).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
    vi.restoreAllMocks();
  });

  it("invalid uuid text → VALIDATION", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(toErrorResult(await thrown(sql`select ${"not-a-uuid"}::uuid`))).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
    vi.restoreAllMocks();
  });
});

describe("runAction", () => {
  it("wraps the return value", async () => {
    await expect(runAction(async () => ({ id: "1" }))).resolves.toEqual({ ok: true, data: { id: "1" } });
  });

  it("returns mapped errors instead of throwing", async () => {
    await expect(
      runAction(async () => {
        throw conflict();
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "CONFLICT", message: "Dieser Eintrag existiert bereits." },
    });
  });

  it("maps schema.parse failures", async () => {
    const result = await runAction(async () => z.object({ name: z.string() }).parse({}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fieldErrors).toHaveProperty("name");
  });

  it("lets Next.js redirect() propagate", async () => {
    const promise = runAction(async () => {
      redirect("/login");
    });
    await expect(promise).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT/) });
  });

  it("lets Next.js notFound() propagate", async () => {
    await expect(
      runAction(async () => {
        nextNotFound();
      }),
    ).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK/) });
  });
});

describe("isNextControlFlowError", () => {
  it("detects redirect and notFound, not regular errors", () => {
    expect(isNextControlFlowError(catchSync(() => redirect("/x")))).toBe(true);
    expect(isNextControlFlowError(catchSync(() => nextNotFound()))).toBe(true);
    expect(isNextControlFlowError(new Error("x"))).toBe(false);
    expect(isNextControlFlowError(new AppError("NOT_FOUND", "x"))).toBe(false);
    expect(isNextControlFlowError(null)).toBe(false);
  });
});

describe("helpers", () => {
  it("ok / fail build results", () => {
    expect(ok(1)).toEqual({ ok: true, data: 1 });
    expect(fail("FORBIDDEN", "Nein")).toEqual({ ok: false, error: { code: "FORBIDDEN", message: "Nein" } });
    expect(fail("VALIDATION", "x", { a: ["b"] })).toEqual({
      ok: false,
      error: { code: "VALIDATION", message: "x", fieldErrors: { a: ["b"] } },
    });
  });

  it("unwrap returns data or throws AppError", () => {
    expect(unwrap(ok("x"))).toBe("x");
    const err = catchSync(() => unwrap(fail("NOT_FOUND", "Weg")));
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: "NOT_FOUND", message: "Weg" });
  });

  it("toErrorResponse maps codes to HTTP statuses", async () => {
    const res = toErrorResponse(notFound());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Eintrag nicht gefunden." } });

    const limited = toErrorResponse(new AppError("RATE_LIMITED", "Langsam"));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");

    expect(toErrorResponse(z.string().safeParse(1).error).status).toBe(400);
  });

  it("toErrorResponse rethrows Next.js control flow", () => {
    const redirectErr = catchSync(() => redirect("/login"));
    expect(() => toErrorResponse(redirectErr)).toThrow();
  });
});
