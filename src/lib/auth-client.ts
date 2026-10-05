import { createAuthClient } from "better-auth/react";

/**
 * better-auth client for client components. Talks to /api/auth on the current origin.
 *
 *   const { data, error } = await signIn.email({ email, password });
 *   const { data: session, isPending } = useSession();
 *
 * Errors come back as `{ code, message, status }`: map them with
 * authErrorMessage() from src/server/auth/messages.ts (German copy).
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
