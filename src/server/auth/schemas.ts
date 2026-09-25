import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./policy";

/**
 * Zod schemas for auth + account forms. Isomorphic (no server-only): used by the client
 * forms (react-hook-form) and re-validated in server actions.
 */

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Bitte gib deinen Namen ein.")
  .max(60, "Der Name darf höchstens 60 Zeichen lang sein.");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Bitte gib deine E-Mail-Adresse ein.")
  .max(254, "Diese E-Mail-Adresse ist zu lang.")
  .pipe(z.email("Bitte gib eine gültige E-Mail-Adresse ein (z. B. name@beispiel.de)."));

/** Policy for NEW passwords (signup, change password). */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Das Passwort braucht mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`)
  .max(PASSWORD_MAX_LENGTH, `Das Passwort darf höchstens ${PASSWORD_MAX_LENGTH} Zeichen lang sein.`);

/** Existing passwords are only checked for presence – the server verifies them. */
export const currentPasswordSchema = z.string().min(1, "Bitte gib dein Passwort ein.");

export const loginSchema = z.object({
  email: emailSchema,
  password: currentPasswordSchema,
});
export type LoginInput = z.input<typeof loginSchema>;

export const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});
export type SignupInput = z.input<typeof signupSchema>;

export const changeNameSchema = z.object({ name: nameSchema });
export type ChangeNameInput = z.input<typeof changeNameSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: newPasswordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ["newPassword"],
    message: "Das neue Passwort muss sich vom aktuellen unterscheiden.",
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

/** The word users type to confirm account deletion. */
export const DELETE_CONFIRMATION_WORD = "LÖSCHEN";

export const deleteAccountSchema = z.object({
  password: currentPasswordSchema,
  confirmation: z
    .string()
    .trim()
    .refine((v) => v.toUpperCase() === DELETE_CONFIRMATION_WORD, {
      message: `Bitte tippe „${DELETE_CONFIRMATION_WORD}“ zur Bestätigung.`,
    }),
});
export type DeleteAccountInput = z.input<typeof deleteAccountSchema>;
