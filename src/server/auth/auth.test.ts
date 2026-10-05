import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import type { Db } from "@/server/db/create";
import { account, meals, session, user, userProfiles } from "@/server/db/schema";
import { createAuth, type Auth } from "./auth";
import { authErrorMessage } from "./messages";

let db: Db;
let auth: Auth;

beforeAll(async () => {
  db = await createTestDb();
  auth = createAuth(db, {
    secret: "test-secret-test-secret-test-secret-123",
    baseURL: "http://localhost:3000",
  });
});

async function errorOf(p: Promise<unknown>): Promise<{ code?: string; status?: number }> {
  try {
    await p;
  } catch (err) {
    const e = err as { body?: { code?: string }; statusCode?: number };
    return { code: e.body?.code, status: e.statusCode };
  }
  throw new Error("expected the call to fail");
}

describe("better-auth integration (email + password)", () => {
  const email = "lena@example.com";
  const password = "sicheres-passwort";

  it("signs up, stores snake_case rows and bootstraps profile + default meals", async () => {
    const res = await auth.api.signUpEmail({ body: { name: "Lena", email, password } });
    expect(res.user.email).toBe(email);
    expect(res.token).toBeTruthy(); // autoSignIn

    const [row] = await db.select().from(user).where(eq(user.email, email));
    expect(row).toMatchObject({ name: "Lena", emailVerified: false });

    const [cred] = await db.select().from(account).where(eq(account.userId, row.id));
    expect(cred.providerId).toBe("credential");
    expect(cred.password).not.toBe(password); // hashed

    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, row.id));
    expect(profile).toMatchObject({ timezone: "Europe/Berlin", onboardingCompletedAt: null });

    const userMeals = await db.select().from(meals).where(eq(meals.userId, row.id)).orderBy(meals.sortOrder);
    expect(userMeals.map((m) => m.name)).toEqual(["Frühstück", "Mittagessen", "Abendessen", "Snacks"]);
  });

  it("signs in and resolves the session from the cookie with a ~30 day lifetime", async () => {
    const res = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("better-auth.session_token=");

    const cookie = setCookie.split(";")[0];
    const current = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(current?.user.email).toBe(email);

    const days = (current!.session.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);

    const sessions = await db.select().from(session).where(eq(session.userId, current!.user.id));
    expect(sessions.length).toBeGreaterThanOrEqual(2); // signup + signin
  });

  it("rejects a wrong password with a German message", async () => {
    const err = await errorOf(auth.api.signInEmail({ body: { email, password: "falsches-passwort" } }));
    expect(err.code).toBe("INVALID_EMAIL_OR_PASSWORD");
    expect(authErrorMessage(err)).toBe("E-Mail oder Passwort ist falsch.");
  });

  it("rejects a duplicate email", async () => {
    const err = await errorOf(auth.api.signUpEmail({ body: { name: "Lena 2", email, password } }));
    expect(err.code).toMatch(/^USER_ALREADY_EXISTS/);
    expect(authErrorMessage(err)).toBe("Für diese E-Mail gibt es bereits ein Konto.");
  });

  it("enforces the password length policy (8-128)", async () => {
    const short = await errorOf(
      auth.api.signUpEmail({ body: { name: "Kurz", email: "kurz@example.com", password: "1234567" } }),
    );
    expect(short.code).toBe("PASSWORD_TOO_SHORT");
    const long = await errorOf(
      auth.api.signUpEmail({ body: { name: "Lang", email: "lang@example.com", password: "x".repeat(129) } }),
    );
    expect(long.code).toBe("PASSWORD_TOO_LONG");
  });

  it("changes the password and verifies the current one", async () => {
    const res = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
    const headers = new Headers({ cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] });

    const wrong = await errorOf(
      auth.api.changePassword({ body: { currentPassword: "nope-nope", newPassword: "neues-passwort" }, headers }),
    );
    expect(wrong.code).toBe("INVALID_PASSWORD");

    await auth.api.changePassword({
      body: { currentPassword: password, newPassword: "neues-passwort", revokeOtherSessions: true },
      headers,
    });
    const again = await auth.api.signInEmail({ body: { email, password: "neues-passwort" } });
    expect(again.user.email).toBe(email);
  });

  it("verifies the password (delete-account guard) and updates the name", async () => {
    const res = await auth.api.signInEmail({ body: { email, password: "neues-passwort" }, returnHeaders: true });
    const headers = new Headers({ cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] });

    const wrong = await errorOf(auth.api.verifyPassword({ body: { password: "falsch-falsch" }, headers }));
    expect(wrong.code).toBe("INVALID_PASSWORD");
    await expect(auth.api.verifyPassword({ body: { password: "neues-passwort" }, headers })).resolves.toMatchObject({
      status: true,
    });

    await auth.api.updateUser({ body: { name: "Lena M." }, headers });
    const [row] = await db.select().from(user).where(eq(user.email, email));
    expect(row.name).toBe("Lena M.");
  });
});
