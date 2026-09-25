import { ZodError } from "zod";
import { AppError, type AppErrorCode } from "./errors";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AppErrorCode; message: string; fieldErrors?: Record<string, string[]> } };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

/** Maps thrown errors to a serializable ActionResult. */
export function toErrorResult(err: unknown): ActionResult<never> {
  if (err instanceof AppError) {
    return { ok: false, error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } };
  }
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: { code: "VALIDATION", message: "Bitte Eingaben prüfen.", fieldErrors } };
  }
  console.error("[action] unexpected error", err);
  return { ok: false, error: { code: "INTERNAL", message: "Etwas ist schiefgelaufen. Bitte erneut versuchen." } };
}

/** Wraps a server-action body: returns ok(data) or a mapped error result. Never throws. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (err) {
    // Let Next.js control-flow errors (redirect/notFound) propagate.
    if (err && typeof err === "object" && "digest" in err && typeof err.digest === "string" && /^NEXT_/.test(err.digest)) {
      throw err;
    }
    return toErrorResult(err);
  }
}
