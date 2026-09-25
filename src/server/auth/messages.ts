/**
 * German, user-facing messages for better-auth error codes.
 * Pure module (no server-only): used by the client forms and by server actions.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-Mail oder Passwort ist falsch.",
  INVALID_PASSWORD: "Das Passwort ist nicht korrekt.",
  INVALID_EMAIL: "Bitte gib eine gültige E-Mail-Adresse ein.",
  USER_ALREADY_EXISTS: "Für diese E-Mail gibt es bereits ein Konto.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Für diese E-Mail gibt es bereits ein Konto.",
  PASSWORD_TOO_SHORT: "Das Passwort ist zu kurz (mindestens 8 Zeichen).",
  PASSWORD_TOO_LONG: "Das Passwort ist zu lang (höchstens 128 Zeichen).",
  USER_NOT_FOUND: "Konto nicht gefunden.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Für dieses Konto ist kein Passwort hinterlegt.",
  SESSION_EXPIRED: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  UNAUTHORIZED: "Bitte melde dich erneut an.",
  FAILED_TO_CREATE_USER: "Das Konto konnte nicht erstellt werden. Bitte versuche es erneut.",
  FAILED_TO_CREATE_SESSION: "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
  TOO_MANY_REQUESTS: "Zu viele Versuche. Bitte warte kurz und versuche es dann erneut.",
};

export const GENERIC_AUTH_ERROR = "Etwas ist schiefgelaufen. Bitte versuche es erneut.";

/** Maps a better-auth error (code and/or HTTP status) to a German message. */
export function authErrorMessage(error: { code?: string | null; status?: number | null } | null | undefined): string {
  if (!error) return GENERIC_AUTH_ERROR;
  if (error.code && AUTH_ERROR_MESSAGES[error.code]) return AUTH_ERROR_MESSAGES[error.code];
  if (error.status === 429) return AUTH_ERROR_MESSAGES.TOO_MANY_REQUESTS;
  return GENERIC_AUTH_ERROR;
}
