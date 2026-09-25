/**
 * Tiny structured logger (no dependencies).
 *
 *   import { logger } from "@/lib/logger";
 *   const log = logger.child({ scope: "food-search" });
 *   log.info("external lookup", { provider: "off", ms: 123 });
 *   log.error("provider failed", { err });
 *
 * - Level from LOG_LEVEL (debug|info|warn|error|silent). Default: debug in dev,
 *   info in production, warn in tests.
 * - Production: one JSON object per line (`{"time","level","msg",...fields}`).
 *   Otherwise: human-readable `12:00:01.123 INFO  [scope] msg key=value`.
 * - Error values in fields are serialized (name, message, code, stack, cause).
 * - Reads process.env directly (not @/lib/env) so logging works even when env validation fails.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogLevelSetting = LogLevel | "silent";
export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** Returns a logger that adds `bindings` to every entry, e.g. `{ scope: "auth" }`. */
  child(bindings: LogFields): Logger;
}

export interface LoggerOptions {
  /** Fixed level. Default: resolved from LOG_LEVEL / NODE_ENV on every call. */
  level?: LogLevelSetting;
  /** Output format. Default: json in production, pretty otherwise. */
  format?: "json" | "pretty";
  bindings?: LogFields;
  /** Output sink (tests). Default: console.log / console.warn / console.error. */
  write?: (level: LogLevel, line: string) => void;
  now?: () => Date;
}

const LEVEL_ORDER: Record<LogLevelSetting, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

function defaultLevel(): LogLevelSetting {
  const fromEnv = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (fromEnv && fromEnv in LEVEL_ORDER) return fromEnv as LogLevelSetting;
  if (process.env.NODE_ENV === "production") return "info";
  if (process.env.NODE_ENV === "test") return "warn";
  return "debug";
}

/** Serializes Errors (incl. cause chain) and other non-JSON values. */
export function serializeError(err: unknown, depth = 0): unknown {
  if (!(err instanceof Error)) return err;
  const out: Record<string, unknown> = { name: err.name, message: err.message };
  const extra = err as Error & { code?: unknown; digest?: unknown };
  if (extra.code !== undefined) out.code = extra.code;
  if (extra.digest !== undefined) out.digest = extra.digest;
  if (err.stack) out.stack = err.stack;
  if (err.cause !== undefined && depth < 3) out.cause = serializeError(err.cause, depth + 1);
  return out;
}

function normalizeFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    out[key] = value instanceof Error ? serializeError(value) : value;
  }
  return out;
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v === "bigint") return v.toString();
    if (v && typeof v === "object") {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
    }
    return v;
  });
}

function pad2(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function formatPretty(time: Date, level: LogLevel, msg: string, fields: LogFields): string {
  const { scope, ...rest } = fields;
  const ts = `${pad2(time.getHours())}:${pad2(time.getMinutes())}:${pad2(time.getSeconds())}.${pad2(time.getMilliseconds(), 3)}`;
  const head = `${ts} ${level.toUpperCase().padEnd(5)}${scope ? ` [${String(scope)}]` : ""} ${msg}`;
  const stacks: string[] = [];
  const kv = Object.entries(rest).map(([k, v]) => {
    if (v && typeof v === "object" && "stack" in v && typeof v.stack === "string") {
      stacks.push(v.stack);
      const withoutStack: Record<string, unknown> = { ...v };
      delete withoutStack.stack;
      return `${k}=${safeStringify(withoutStack)}`;
    }
    return `${k}=${typeof v === "string" ? v : safeStringify(v)}`;
  });
  return [head, ...(kv.length ? [kv.join(" ")] : [])].join(" ") + (stacks.length ? `\n${stacks.join("\n")}` : "");
}

const consoleWrite = (level: LogLevel, line: string) => {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

export function createLogger(options: LoggerOptions = {}): Logger {
  const bindings = options.bindings ?? {};
  const write = options.write ?? consoleWrite;
  const now = options.now ?? (() => new Date());

  const log = (level: LogLevel, msg: string, fields?: LogFields) => {
    const threshold = options.level ?? defaultLevel();
    if (LEVEL_ORDER[level] < LEVEL_ORDER[threshold]) return;
    const merged = normalizeFields({ ...bindings, ...fields });
    const format = options.format ?? (process.env.NODE_ENV === "production" ? "json" : "pretty");
    const time = now();
    const line =
      format === "json"
        ? safeStringify({ time: time.toISOString(), level, msg, ...merged })
        : formatPretty(time, level, msg, merged);
    write(level, line);
  };

  return {
    debug: (msg, fields) => log("debug", msg, fields),
    info: (msg, fields) => log("info", msg, fields),
    warn: (msg, fields) => log("warn", msg, fields),
    error: (msg, fields) => log("error", msg, fields),
    child: (childBindings) => createLogger({ ...options, bindings: { ...bindings, ...childBindings } }),
  };
}

/** App-wide root logger. Use `logger.child({ scope })` per module. */
export const logger: Logger = createLogger();
