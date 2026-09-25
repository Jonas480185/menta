"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUp } from "@/lib/auth-client";
import { authErrorMessage } from "@/server/auth/messages";
import { PASSWORD_MIN_LENGTH } from "@/server/auth/policy";
import { ONBOARDING_PATH } from "@/server/auth/redirects";
import { signupSchema, type SignupInput } from "@/server/auth/schemas";
import { FormMessage, PasswordField, SubmitButton, TextField } from "../_components/form-controls";

export function SignupForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { error } = await signUp.email({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    });
    if (error) {
      const message = authErrorMessage(error);
      if (error.code?.startsWith("USER_ALREADY_EXISTS")) {
        setError("email", { message: `${message} Melde dich stattdessen an.` }, { shouldFocus: true });
      } else if (error.code?.startsWith("PASSWORD_")) {
        setError("password", { message }, { shouldFocus: true });
      } else {
        setFormError(message);
        setFocus("email");
      }
      return;
    }
    // New accounts always start with onboarding (goals are set up there).
    router.replace(ONBOARDING_PATH);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormMessage>{formError}</FormMessage>
      <TextField
        label="Name"
        autoComplete="name"
        autoCapitalize="words"
        placeholder="Wie dürfen wir dich nennen?"
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        label="E-Mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="name@beispiel.de"
        error={errors.email?.message}
        {...register("email")}
      />
      <PasswordField
        label="Passwort"
        autoComplete="new-password"
        hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`}
        error={errors.password?.message}
        {...register("password")}
      />
      <SubmitButton pending={isSubmitting} pendingLabel="Konto wird erstellt …" className="mt-1 w-full">
        Konto erstellen
      </SubmitButton>
    </form>
  );
}
