import { isAPIError } from "better-auth/api";
import { AppError } from "@/lib/errors";
import { authErrorMessage } from "./messages";

/**
 * Runs a better-auth server API call and converts its APIError into an AppError with a
 * German message (optionally attached to a form field), so server actions can return a
 * normal ActionResult via runAction().
 */
export async function callAuthApi<T>(fn: () => Promise<T>, fieldForCode: Record<string, string> = {}): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isAPIError(err)) throw err;
    const code = typeof err.body?.code === "string" ? err.body.code : undefined;
    const message = authErrorMessage({ code, status: err.statusCode });
    const field = code ? fieldForCode[code] : undefined;
    if (err.statusCode === 401 && !field) throw new AppError("UNAUTHORIZED", message);
    if (err.statusCode === 429) throw new AppError("RATE_LIMITED", message);
    throw new AppError("VALIDATION", message, field ? { [field]: [message] } : undefined);
  }
}
