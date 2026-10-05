import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import { createTestDb } from "@/test/db";
import type { Db } from "@/server/db/create";
import { createAuth, type Auth } from "./auth";
import { assertNotDemo, isDemoMode } from "./demo";

const ORIGIN = "http://localhost:3000";
const SECRET = "test-secret-test-secret-test-secret-123";
const DEMO = { email: "demo@menta.app", password: "menta-demo-2026" };

let db: Db;
let demoAuth: Auth;

vi.mock("./server", () => ({ getAuth: async () => demoAuth }));

function enableDemo(on: boolean) {
  vi.stubEnv("DEMO_MODE", on ? "true" : "false");
  resetEnvCache();
}

beforeAll(async () => {
  db = await createTestDb();
  await createAuth(db, { secret: SECRET, baseURL: ORIGIN }).api.signUpEmail({ body: { name: "Demo", ...DEMO } });
  enableDemo(true);
  demoAuth = createAuth(db, { secret: SECRET, baseURL: ORIGIN });
});

afterEach(() => {
  enableDemo(true);
});

describe("demo guards", () => {
  it("assertNotDemo blocks account changes only in demo mode", () => {
    expect(isDemoMode()).toBe(true);
    try {
      assertNotDemo();
      throw new Error("expected assertNotDemo to throw");
    } catch (err) {
      expect(isAppError(err) && err.code).toBe("FORBIDDEN");
    }
    enableDemo(false);
    expect(() => assertNotDemo()).not.toThrow();
  });

  it("switches off account-changing auth endpoints but keeps sign-in", async () => {
    const post = (path: string, body: unknown) =>
      demoAuth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: ORIGIN },
          body: JSON.stringify(body),
        }),
      );
    expect((await post("/change-password", { currentPassword: DEMO.password, newPassword: "x".repeat(12) })).status).toBe(404);
    expect((await post("/sign-up/email", { name: "X", email: "x@example.com", password: "x".repeat(12) })).status).toBe(404);
    expect((await post("/sign-in/email", DEMO)).status).toBe(200);
  });
});

describe("GET /api/demo", () => {
  it("signs in to the demo account and redirects to a safe next path", async () => {
    const { GET } = await import("@/app/api/demo/route");
    const res = await GET(new Request(`${ORIGIN}/api/demo?next=%2Fdiary`));
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/diary`);
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token"))).toBe(true);

    const evil = await GET(new Request(`${ORIGIN}/api/demo?next=%2F%2Fevil.com`));
    expect(evil.headers.get("Location")).toBe(`${ORIGIN}/today`);
  });

  it("does not exist outside demo mode", async () => {
    enableDemo(false);
    const { GET } = await import("@/app/api/demo/route");
    expect((await GET(new Request(`${ORIGIN}/api/demo`))).status).toBe(404);
  });
});
