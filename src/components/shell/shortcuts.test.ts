import { describe, expect, it } from "vitest";
import { resolveShortcut, shortcutFor } from "./shortcuts";

const key = (k: string, extra: Partial<Parameters<typeof resolveShortcut>[0]> = {}) =>
  resolveShortcut({ key: k, metaKey: false, ctrlKey: false, altKey: false, typing: false, ...extra });

describe("resolveShortcut", () => {
  it("maps single keys to navigation", () => {
    expect(key("n")).toEqual({ type: "navigate", href: "/log" });
    expect(key("N")).toEqual({ type: "navigate", href: "/log" });
    expect(key("2")).toEqual({ type: "navigate", href: "/diary" });
  });

  it("opens search with / and ⌘K / Ctrl+K", () => {
    expect(key("/")).toEqual({ type: "search" });
    expect(key("k", { metaKey: true })).toEqual({ type: "search" });
    expect(key("K", { ctrlKey: true, typing: true })).toEqual({ type: "search" });
  });

  it("shows help with ?", () => {
    expect(key("?")).toEqual({ type: "help" });
  });

  it("ignores keys while typing or with modifiers", () => {
    expect(key("n", { typing: true })).toBeNull();
    expect(key("1", { metaKey: true })).toBeNull();
    expect(key("n", { altKey: true })).toBeNull();
    expect(key("Enter")).toBeNull();
    expect(key("x")).toBeNull();
  });
});

describe("shortcutFor", () => {
  it("returns the key for a nav target", () => {
    expect(shortcutFor("/today")).toBe("1");
    expect(shortcutFor("/recipes")).toBeUndefined();
  });
});
