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

/**
 * Runs `fn` in a transaction with a context whose `db` is the transaction.
 * Nested calls become savepoints. Throwing (e.g. AppError) rolls back.
 *
 *   await inTransaction(ctx, async (tx) => {
 *     const recipe = await insertRecipe(tx, input);
 *     await insertIngredients(tx, recipe.id, input.ingredients);
 *   });
 */
export function inTransaction<T>(ctx: ServiceContext, fn: (tx: ServiceContext) => Promise<T>): Promise<T> {
  return ctx.db.transaction((db) => fn({ ...ctx, db }));
}
