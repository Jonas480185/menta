import { customType, timestamp } from "drizzle-orm/pg-core";

/** Timestamps shared by most tables. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Postgres tsvector, used for full-text search columns. */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});
