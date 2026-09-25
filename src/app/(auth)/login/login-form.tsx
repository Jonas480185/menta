"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "@/lib/auth-client";
import { authErrorMessage } from "@/server/auth/messages";
import { loginSchema, type LoginInput } from "@/server/auth/schemas";
import { FormMessage, PasswordField, SubmitButton, TextField } from "../_components/form-controls";

export function LoginForm({ next, notice }: { next: string | null; notice?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { error } = await signIn.email({ email: values.email.trim(), password: values.password });
    if (error) {
      setFormError(authErrorMessage(error));
      setFocus("password");
      return;
    }
    // "/" routes to /onboarding or /today depending on the profile.
    router.replace(next ?? "/");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {notice && !formError ? <FormMessage tone="success">{notice}</FormMessage> : null}
      <FormMessage>{formError}</FormMessage>
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
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <SubmitButton pending={isSubmitting} pendingLabel="Wird angemeldet …" className="mt-1 w-full">
        Anmelden
      </SubmitButton>
    </form>
  );
}
