"use client";

import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import {
  DELETE_CONFIRMATION_WORD,
  deleteAccountSchema,
  type DeleteAccountInput,
} from "@/server/auth/schemas";
import {
  buttonClass,
  FormMessage,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/app/(auth)/_components/form-controls";
import { deleteAccountAction } from "../actions";

const EMPTY: DeleteAccountInput = { password: "", confirmation: "" };

/**
 * "Konto löschen" with a modal confirmation (native <dialog>: focus trap, Esc to close,
 * inert background). Requires the password and typing the confirmation word.
 */
export function DeleteAccount() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    mode: "onTouched",
    defaultValues: EMPTY,
  });
  const confirmation = useWatch({ control, name: "confirmation" }) ?? "";
  const confirmationMatches = confirmation.trim().toUpperCase() === DELETE_CONFIRMATION_WORD;

  const open = () => {
    reset(EMPTY);
    setFormError(null);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // On success the action redirects to /login: this component unmounts.
    const res = await deleteAccountAction(values);
    if (res.ok) return;
    if (res.error.fieldErrors?.password) {
      setError("password", { message: res.error.fieldErrors.password[0] }, { shouldFocus: true });
    } else {
      setFormError(res.error.message);
    }
  });

  return (
    <>
      <button type="button" onClick={open} className={buttonClass("destructive", "w-full sm:w-auto")}>
        <Trash2 aria-hidden className="size-5" />
        Konto löschen
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-desc"
        onClose={() => reset(EMPTY)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <h2 id="delete-account-title" className="text-lg font-semibold text-foreground">
              Konto endgültig löschen?
            </h2>
            <p id="delete-account-desc" className="mt-2 text-sm text-muted-foreground">
              Dein Profil, deine Ziele, alle Tagebucheinträge, eigenen Lebensmittel, Rezepte sowie Gewichts-,
              Aktivitäts- und Wasserdaten werden sofort und unwiderruflich gelöscht. Tipp: Lade vorher deine Daten
              herunter.
            </p>
          </div>

          <FormMessage>{formError}</FormMessage>

          <PasswordField
            label="Passwort"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <TextField
            label={`Tippe „${DELETE_CONFIRMATION_WORD}“ zur Bestätigung`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            error={errors.confirmation?.message}
            {...register("confirmation")}
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className={buttonClass("secondary")} autoFocus>
              Abbrechen
            </button>
            <SubmitButton
              variant="destructive"
              pending={isSubmitting}
              pendingLabel="Wird gelöscht …"
              disabled={!confirmationMatches}
            >
              Endgültig löschen
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
