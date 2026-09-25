import { describe, expect, it } from "vitest";
import { isAuthPage, isProtectedPath, loginPath, safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it.each([
    ["/today", "/today"],
    ["/diary/2026-09-25?x=1", "/diary/2026-09-25?x=1"],
    ["/log?date=2026-09-25&meal=abc", "/log?date=2026-09-25&meal=abc"],
  ])("accepts %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [""],
    ["today"],
    ["//evil.com"],
    ["/\\evil.com"],
    ["https://evil.com/today"],
    ["javascript:alert(1)"],
    ["/login"],
    ["/signup?next=/today"],
    ["/to\nday"],
  ])("rejects %s", (input) => {
    expect(safeNextPath(input)).toBeNull();
  });
});

describe("route classification", () => {
  it("detects protected app routes by segment", () => {
    expect(isProtectedPath("/today")).toBe(true);
    expect(isProtectedPath("/settings/account")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/todayx")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });

  it("detects auth pages", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/signup")).toBe(true);
    expect(isAuthPage("/settings")).toBe(false);
  });

  it("builds login URLs with an encoded next param", () => {
    expect(loginPath()).toBe("/login");
    expect(loginPath("/diary?d=1")).toBe("/login?next=%2Fdiary%3Fd%3D1");
    expect(loginPath("//evil.com")).toBe("/login");
  });
});
