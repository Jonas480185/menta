export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EXTERNAL"
  | "INTERNAL";

/**
 * Expected, user-presentable failure. Services throw AppError; server actions convert it
 * to an ActionResult (see src/lib/result.ts). Anything else is treated as INTERNAL.
 */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Eintrag") => new AppError("NOT_FOUND", `${what} nicht gefunden.`);
export const forbidden = () => new AppError("FORBIDDEN", "Keine Berechtigung.");
