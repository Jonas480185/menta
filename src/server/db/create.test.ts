import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import {
  DataDirLockedError,
  acquireDataDirLock,
  lockPathFor,
  releaseDataDirLock,
  resolveDbDriver,
} from "./create";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pglite-lock-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("resolveDbDriver", () => {
  it.each([
    [undefined, "pglite"],
    ["", "pglite"],
    ["postgres://localhost/db", "postgres"],
    ["postgresql://u:p@host:5432/db", "postgres"],
  ] as const)("%s → %s", (url, driver) => {
    expect(resolveDbDriver(url)).toBe(driver);
  });
});

describe("PGlite data-dir lock", () => {
  it("writes <dir>.lock with our pid and removes it on release", () => {
    const dir = path.join(tmp, "a");
    acquireDataDirLock(dir);
    expect(fs.readFileSync(lockPathFor(dir), "utf8")).toBe(String(process.pid));
    releaseDataDirLock(dir);
    expect(fs.existsSync(lockPathFor(dir))).toBe(false);
  });

  it("refuses to open the same dir twice in one process", () => {
    const dir = path.join(tmp, "b");
    acquireDataDirLock(dir);
    expect(() => acquireDataDirLock(dir)).toThrow(/already open in this process/);
    releaseDataDirLock(dir);
  });

  it("refuses when another live process holds the lock", async () => {
    const dir = path.join(tmp, "c");
    const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"]);
    try {
      fs.writeFileSync(lockPathFor(dir), String(child.pid));
      const attempt = () => acquireDataDirLock(dir);
      expect(attempt).toThrow(DataDirLockedError);
      expect(attempt).toThrow(new RegExp(`in use by process ${child.pid}`));
    } finally {
      child.kill("SIGKILL");
      await new Promise((resolve) => child.once("exit", resolve));
    }
    // Holder is gone → stale lock is taken over.
    acquireDataDirLock(dir);
    expect(fs.readFileSync(lockPathFor(dir), "utf8")).toBe(String(process.pid));
    releaseDataDirLock(dir);
  });

  it("ignores trailing slashes", () => {
    expect(lockPathFor("/x/pglite/")).toBe("/x/pglite.lock");
  });
});
