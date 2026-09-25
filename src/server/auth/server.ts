import "server-only";
import { getDb } from "@/server/db/client";
import { createAuth, type Auth } from "./auth";

/**
 * Process-wide better-auth instance, built lazily because the database is async.
 * Cached on globalThis so HMR doesn't create duplicate instances.
 */
const globalForAuth = globalThis as unknown as { __auth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  if (!globalForAuth.__auth) {
    globalForAuth.__auth = getDb()
      .then((db) => createAuth(db))
      .catch((err) => {
        globalForAuth.__auth = undefined; // allow a retry on the next request
        throw err;
      });
  }
  return globalForAuth.__auth;
}

export type { Auth } from "./auth";
