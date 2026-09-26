/**
 * Goals service.
 *
 * After any successful write (upsert/create/update/archive/setProfileWeekdays) callers must call
 * Daily Nutrition Engine's `refreshTargetsFrom(ctx, todayInTimezone(ctx.timezone))` from
 * `@/server/services/nutrition` so today's and future daily_nutrition targets follow the change.
 *
 * Docs: docs/architecture/macro-engine.md
 */
export * from "./resolve";
export * from "./profiles";
export * from "./schemas";
