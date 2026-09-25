import type { DbOrTx } from "./db/create";

/**
 * Every server-side service function takes a ServiceContext as its first argument.
 * Services never read cookies/sessions themselves – that keeps them unit-testable
 * against an in-memory database (see src/test/db.ts).
 *
 *   await addEntry(ctx, input)
 *
 * Server actions / route handlers build the context via getServiceContext()
 * in src/server/auth/context.ts.
 */
export interface ServiceContext {
  db: DbOrTx;
  userId: string;
  /** IANA timezone of the user, used to resolve "today". */
  timezone: string;
}
