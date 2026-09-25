import "server-only";
import type { ServiceContext } from "@/server/context";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * CONTRACT. Signatures are fixed.
 * FOUNDATION STUB – Auth implements with better-auth.
 */

/** Current user or null (no redirect). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  throw new Error("auth not implemented yet");
}

/** Current user; redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  throw new Error("auth not implemented yet");
}

/** Service context for the signed-in user (redirects to /login when signed out). */
export async function getServiceContext(): Promise<ServiceContext> {
  throw new Error("auth not implemented yet");
}
