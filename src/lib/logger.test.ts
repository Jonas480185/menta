import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger, serializeError, type LogLevel } from "./logger";

function capture(options: Parameters<typeof createLogger>[0] = {}) {
  const lines: { level: LogLevel; line: string }[] = [];
  const log = createLogger({
    now: () => new Date("2026-09-22T10:11:12.013Z"),
    write: (level, line) => lines.push({ level, line }),
    ...options,
  });
  return { log, lines };
}

describe("logger", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("writes JSON lines with bindings and fields", () => {
    const { log, lines } = capture({ format: "json", level: "debug" });
    log.child({ scope: "search" }).info("lookup", { provider: "off", ms: 12 });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0].line)).toEqual({
      time: "2026-09-22T10:11:12.013Z",
      level: "info",
      msg: "lookup",
      scope: "search",
      provider: "off",
      ms: 12,
    });
  });

  it("filters below the configured level", () => {
    const { log, lines } = capture({ format: "json", level: "warn" });
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(lines.map((l) => l.level)).toEqual(["warn", "error"]);
  });

  it("silent disables all output", () => {
    const { log, lines } = capture({ level: "silent" });
    log.error("nope");
    expect(lines).toHaveLength(0);
  });

  it("reads LOG_LEVEL lazily when no level is fixed", () => {
    const { log, lines } = capture({ format: "json" });
    vi.stubEnv("LOG_LEVEL", "error");
    log.warn("hidden");
    vi.stubEnv("LOG_LEVEL", "debug");
    log.debug("shown");
    expect(lines.map((l) => JSON.parse(l.line).msg)).toEqual(["shown"]);
  });

  it("child bindings merge and later fields win", () => {
    const { log, lines } = capture({ format: "json", level: "debug" });
    log.child({ scope: "a", req: 1 }).child({ scope: "b" }).info("x", { req: 2 });
    expect(JSON.parse(lines[0].line)).toMatchObject({ scope: "b", req: 2 });
  });

  it("serializes errors including code and cause", () => {
    const { log, lines } = capture({ format: "json", level: "debug" });
    const cause = Object.assign(new Error("duplicate key"), { code: "23505" });
    log.error("insert failed", { err: new Error("query failed", { cause }) });
    const entry = JSON.parse(lines[0].line);
    expect(entry.err).toMatchObject({
      name: "Error",
      message: "query failed",
      cause: { message: "duplicate key", code: "23505" },
    });
    expect(entry.err.stack).toContain("query failed");
  });

  it("pretty format is single-line with scope and key=value pairs", () => {
    const { log, lines } = capture({ format: "pretty", level: "debug" });
    log.child({ scope: "db" }).info("ready", { ms: 42, dir: ".data/pglite" });
    expect(lines[0].line).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3} INFO  \[db\] ready ms=42 dir=\.data\/pglite$/);
  });

  it("pretty format prints error stacks on following lines", () => {
    const { log, lines } = capture({ format: "pretty", level: "debug" });
    log.error("boom", { err: new Error("kaputt") });
    const [first, ...rest] = lines[0].line.split("\n");
    expect(first).toContain('err={"name":"Error","message":"kaputt"}');
    expect(rest.join("\n")).toContain("Error: kaputt");
  });

  it("survives circular structures and bigint", () => {
    const { log, lines } = capture({ format: "json", level: "debug" });
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    log.info("x", { circular, big: BigInt(10) });
    expect(JSON.parse(lines[0].line)).toMatchObject({ circular: { a: 1, self: "[Circular]" }, big: "10" });
  });
});

describe("serializeError", () => {
  it("passes through non-errors", () => {
    expect(serializeError("x")).toBe("x");
  });

  it("includes Next.js digests", () => {
    const err = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    expect(serializeError(err)).toMatchObject({ digest: "NEXT_REDIRECT;replace;/login;307;" });
  });
});
