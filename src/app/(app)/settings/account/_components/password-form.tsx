"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PASSWORD_MIN_LENGTH } from "@/server/auth/policy";
import { changePasswordSchema, type ChangePasswordInput } from "@/server/auth/schemas";
import { FormMessage, PasswordField, SubmitButton } from "@/app/(auth)/_components/form-controls";
import { changePasswordAction } from "../actions";

const EMPTY: ChangePasswordInput = { currentPassword: "", newPassword: "" };

export function PasswordForm({ email }: { email: string }) {
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: EMPTY,
  });

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    const res = await changePasswordAction(values);
    if (res.ok) {
      reset(EMPTY);
      setMessage({
        tone: "success",
        text: "Passwort geändert. Auf anderen Geräten wurdest du abgemeldet.",
      });
      return;
    }
    const fields = res.error.fieldErrors ?? {};
    const field = (["currentPassword", "newPassword"] as const).find((f) => fields[f]?.length);
    if (field) setError(field, { message: fields[field][0] }, { shouldFocus: true });
    else setMessage({ tone: "error", text: res.error.message });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      {/* Hidden username so password managers store the new password for the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <PasswordField
        label="Aktuelles Passwort"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <PasswordField
        label="Neues Passwort"
        autoComplete="new-password"
        hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`}
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <SubmitButton pending={isSubmitting} pendingLabel="Wird geändert …" variant="secondary" className="self-start">
        Passwort ändern
      </SubmitButton>
    </form>
  );
}
