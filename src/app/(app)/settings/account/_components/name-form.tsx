"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changeNameSchema, type ChangeNameInput } from "@/server/auth/schemas";
import { FormMessage, SubmitButton, TextField } from "@/app/(auth)/_components/form-controls";
import { changeNameAction } from "../actions";

export function NameForm({ defaultName }: { defaultName: string }) {
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ChangeNameInput>({
    resolver: zodResolver(changeNameSchema),
    mode: "onTouched",
    defaultValues: { name: defaultName },
  });

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    const res = await changeNameAction(values);
    if (res.ok) {
      reset({ name: res.data.name });
      setMessage({ tone: "success", text: "Name gespeichert." });
    } else if (res.error.fieldErrors?.name) {
      setError("name", { message: res.error.fieldErrors.name[0] }, { shouldFocus: true });
    } else {
      setMessage({ tone: "error", text: res.error.message });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <TextField label="Name" autoComplete="name" error={errors.name?.message} {...register("name")} />
      <SubmitButton
        pending={isSubmitting}
        pendingLabel="Wird gespeichert …"
        disabled={!isDirty}
        variant="secondary"
        className="self-start"
      >
        Name speichern
      </SubmitButton>
    </form>
  );
}
