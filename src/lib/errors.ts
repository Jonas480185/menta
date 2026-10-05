export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EXTERNAL"
  | "INTERNAL";

/** HTTP status per error code: used by route handlers (see toErrorResponse in ./result). */
export const APP_ERROR_STATUS: Record<AppErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  EXTERNAL: 502,
  INTERNAL: 500,
};

export type FieldErrors = Record<string, string[]>;

/**
 * Expected, user-presentable failure. Services throw AppError; server actions convert it
 * to an ActionResult (see src/lib/result.ts). Anything else is treated as INTERNAL.
 * Messages are German and shown to the user as-is.
 */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: FieldErrors,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AppError";
  }
}

/** instanceof + structural fallback (survives duplicated module instances across bundles). */
export function isAppError(err: unknown): err is AppError {
  if (err instanceof AppError) return true;
  if (!(err instanceof Error) || err.name !== "AppError") return false;
  const code: unknown = (err as Error & { code?: unknown }).code;
  return typeof code === "string" && code in APP_ERROR_STATUS;
}

export const notFound = (what = "Eintrag") => new AppError("NOT_FOUND", `${what} nicht gefunden.`);
export const forbidden = () => new AppError("FORBIDDEN", "Keine Berechtigung.");
export const unauthorized = () => new AppError("UNAUTHORIZED", "Bitte melde dich an.");
export const conflict = (message = "Dieser Eintrag existiert bereits.") => new AppError("CONFLICT", message);
export const validationError = (fieldErrors: FieldErrors, message = "Bitte Eingaben prüfen.") =>
  new AppError("VALIDATION", message, fieldErrors);
export const rateLimited = () =>
  new AppError("RATE_LIMITED", "Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.");
export const externalError = (
  message = "Der Dienst ist gerade nicht erreichbar. Bitte später erneut versuchen.",
) => new AppError("EXTERNAL", message);
