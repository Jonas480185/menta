"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { FieldErrors } from "./errors";
import type { ActionError, ActionResult } from "./result";

/**
 * Client hook around a server action that returns `ActionResult<T>` (see runAction()).
 *
 *   const { execute, isPending, fieldErrors } = useAction(addEntryAction, {
 *     onSuccess: () => router.push(`/diary/${date}`),
 *     successMessage: "Eingetragen",
 *   });
 *   <Button disabled={isPending} onClick={() => execute({ foodId, grams })}>Hinzufügen</Button>
 *
 * - Runs inside `useTransition` → `isPending` stays true until the action AND the
 *   RSC refresh triggered by revalidatePath() have finished.
 * - Errors: `toast.error(message)` by default (disable with `toastOnError: false`, e.g. when a
 *   form shows `fieldErrors` inline). VALIDATION errors with fieldErrors don't toast by default.
 * - Network failures / thrown errors are mapped to an INTERNAL ActionError (never an unhandled rejection).
 * - `execute` is stable and resolves with the ActionResult, so callers can also `await` it.
 */

export interface UseActionOptions<TData, TArgs extends unknown[]> {
  onSuccess?: (data: TData, ...args: TArgs) => void | Promise<void>;
  onError?: (error: ActionError, ...args: TArgs) => void;
  /** Toast on error: true (always), false (never), "auto" (default: not for VALIDATION with fieldErrors). */
  toastOnError?: boolean | "auto";
  /** Optional success toast text. */
  successMessage?: string | ((data: TData) => string);
}

export interface UseActionReturn<TData, TArgs extends unknown[]> {
  execute: (...args: TArgs) => Promise<ActionResult<TData>>;
  isPending: boolean;
  error: ActionError | null;
  /** Always an object (empty when no errors): `fieldErrors.grams?.[0]`. */
  fieldErrors: FieldErrors;
  data: TData | undefined;
  reset: () => void;
}

export const NETWORK_ERROR: ActionError = {
  code: "INTERNAL",
  message: "Verbindung fehlgeschlagen. Bitte prüfe dein Internet und versuche es erneut.",
};

const EMPTY_FIELD_ERRORS: FieldErrors = Object.freeze({}) as FieldErrors;

function shouldToast(error: ActionError, setting: boolean | "auto"): boolean {
  if (setting !== "auto") return setting;
  return !(error.code === "VALIDATION" && error.fieldErrors && Object.keys(error.fieldErrors).length > 0);
}

export function useAction<TData, TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<ActionResult<TData>>,
  options: UseActionOptions<TData, TArgs> = {},
): UseActionReturn<TData, TArgs> {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<ActionError | null>(null);
  const [data, setData] = useState<TData | undefined>(undefined);

  // Latest action/options without making `execute` unstable.
  const latest = useRef({ action, options });
  useEffect(() => {
    latest.current = { action, options };
  });

  const execute = useCallback(
    (...args: TArgs) =>
      new Promise<ActionResult<TData>>((resolve) => {
        startTransition(async () => {
          const { action: run, options: opts } = latest.current;
          let result: ActionResult<TData>;
          try {
            result = await run(...args);
          } catch {
            result = { ok: false, error: NETWORK_ERROR };
          }

          if (result.ok) {
            setError(null);
            setData(result.data);
            const msg = opts.successMessage;
            if (msg) toast.success(typeof msg === "function" ? msg(result.data) : msg);
            try {
              await opts.onSuccess?.(result.data, ...args);
            } finally {
              resolve(result);
            }
            return;
          }

          setError(result.error);
          if (shouldToast(result.error, opts.toastOnError ?? "auto")) toast.error(result.error.message);
          opts.onError?.(result.error, ...args);
          resolve(result);
        });
      }),
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setData(undefined);
  }, []);

  return { execute, isPending, error, fieldErrors: error?.fieldErrors ?? EMPTY_FIELD_ERRORS, data, reset };
}
