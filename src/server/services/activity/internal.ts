import "server-only";
import { validationError } from "@/lib/errors";
import type { z } from "@/lib/zod";
import { toFieldErrors } from "@/server/services/profile/profile";

/** Parses service input; Zod issues → AppError("VALIDATION") with German fieldErrors. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(toFieldErrors(result.error));
  return result.data;
}
