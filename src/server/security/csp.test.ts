import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "./csp";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `) || d === name);

describe("buildCsp", () => {
  it("allows scripts only via self + nonce in production", () => {
    const csp = buildCsp("abc");
    expect(directive(csp, "script-src")).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("blocks framing, plugins and foreign form targets", () => {
    const csp = buildCsp("abc");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
  });

  it("never puts a nonce into style-src (it would disable 'unsafe-inline' for style attributes)", () => {
    expect(directive(buildCsp("abc"), "style-src")).toBe("style-src 'self' 'unsafe-inline'");
  });

  it("relaxes only what development tooling needs", () => {
    const csp = buildCsp("abc", { dev: true });
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' ws:");
  });
});

describe("createNonce", () => {
  it("returns distinct base64 values of 128 bit", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
