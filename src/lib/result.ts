import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { APP_ERROR_STATUS, AppError, isAppError, type AppErrorCode, type FieldErrors } from "./errors";
import { logger } from "./logger";

/** Serializable error shape returned to the client. `message` is German, user-facing. */
export interface ActionError {
  code: AppErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
}

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

/** Explicit failure without throwing (e.g. early return in an action). */
export const fail = (
  code: AppErrorCode,
  message: string,
  fieldErrors?: FieldErrors,
): ActionResult<never> => ({
  ok: false,
  error: fieldErrors ? { code, message, fieldErrors } : { code, message },
});

export const INTERNAL_MESSAGE = "Etwas ist schiefgelaufen. Bitte erneut versuchen.";
export const VALIDATION_MESSAGE = "Bitte Eingaben prüfen.";

/** Key used in fieldErrors for issues without a path (form-level errors). */
export const FORM_ERROR_KEY = "_";

/**
 * True for Next.js control-flow "errors" (redirect(), notFound(), forbidden(), dynamic usage …)
 * that must propagate instead of being turned into an ActionResult.
 */
export function isNextControlFlowError(err: unknown): boolean {
  try {
    unstable_rethrow(err);
  } catch {
    return true;
  }
  // Fallback for digests Next may add in the future (NEXT_REDIRECT, NEXT_HTTP_ERROR_FALLBACK;404 …).
  return (
    !!err &&
    typeof err === "object" &&
    "digest" in err &&
    typeof err.digest === "string" &&
    /^NEXT_/.test(err.digest)
  );
}

/** Zod issues → `{ "field.path": ["msg", …] }`. */
export function zodFieldErrors(err: ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".") || FORM_ERROR_KEY;
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/** Postgres SQLSTATE → AppError for constraint violations that are user errors, not bugs. */
function fromPostgresError(err: unknown): AppError | undefined {
  // drizzle wraps driver errors (DrizzleQueryError) – the SQLSTATE lives on the cause.
  for (let e: unknown = err, depth = 0; e && typeof e === "object" && depth < 4; depth++) {
    const code = (e as { code?: unknown }).code;
    if (code === "23505")
      return new AppError("CONFLICT", "Dieser Eintrag existiert bereits.", undefined, { cause: err });
    if (code === "23503")
      return new AppError("VALIDATION", "Ein verknüpfter Eintrag existiert nicht (mehr).", undefined, {
        cause: err,
      });
    if (code === "22P02") return new AppError("VALIDATION", "Ungültige Eingabe.", undefined, { cause: err });
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Maps thrown errors to a serializable ActionResult. Unknown errors are logged and become INTERNAL. */
export function toErrorResult(err: unknown): ActionResult<never> {
  if (isAppError(err)) return fail(err.code, err.message, err.fieldErrors);
  if (err instanceof ZodError) return fail("VALIDATION", VALIDATION_MESSAGE, zodFieldErrors(err));
  const pg = fromPostgresError(err);
  if (pg) {
    logger.warn("constraint violation mapped to AppError", { scope: "action", code: pg.code, err });
    return fail(pg.code, pg.message);
  }
  logger.error("unexpected error", { scope: "action", err });
  return fail("INTERNAL", INTERNAL_MESSAGE);
}

/**
 * Wraps a server-action body: returns ok(data) or a mapped error result. Never throws –
 * except for Next.js control flow (redirect/notFound), which must propagate.
 *
 *   export async function addEntry(input: unknown) {
 *     return runAction(async () => {
 *       const data = AddEntrySchema.parse(input);   // ZodError → VALIDATION + fieldErrors
 *       const ctx = await getServiceContext();       // redirect("/login") propagates
 *       const entry = await addMealEntry(ctx, data); // AppError → its code/message
 *       revalidatePath("/today");
 *       return { id: entry.id };
 *     });
 *   }
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    return toErrorResult(err);
  }
}

/** Returns data or throws an AppError – for server-side callers that want exceptions back. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new AppError(result.error.code, result.error.message, result.error.fieldErrors);
}

/**
 * Route handler error → JSON Response `{ error: ActionError }` with a matching HTTP status.
 * Next.js control flow is rethrown.
 *
 *   export async function GET(req: Request) {
 *     try { … return Response.json(data); } catch (err) { return toErrorResponse(err); }
 *   }
 */
export function toErrorResponse(err: unknown, init?: ResponseInit): Response {
  if (isNextControlFlowError(err)) throw err;
  const result = toErrorResult(err);
  const error = result.ok ? { code: "INTERNAL" as const, message: INTERNAL_MESSAGE } : result.error;
  const headers = new Headers(init?.headers);
  if (error.code === "RATE_LIMITED" && !headers.has("Retry-After")) headers.set("Retry-After", "60");
  return Response.json({ error }, { ...init, status: APP_ERROR_STATUS[error.code], headers });
}
