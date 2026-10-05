"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServiceContext, requireUser } from "@/server/auth/context";
import { clearAuthCookies } from "@/server/auth/cookies";
import { assertNotDemo } from "@/server/auth/demo";
import { callAuthApi } from "@/server/auth/errors";
import { LOGIN_PATH } from "@/server/auth/redirects";
import {
  changeNameSchema,
  changePasswordSchema,
  deleteAccountSchema,
  type ChangeNameInput,
  type ChangePasswordInput,
  type DeleteAccountInput,
} from "@/server/auth/schemas";
import { getAuth } from "@/server/auth/server";
import { deleteAccount } from "@/server/services/account/delete";
import { runAction, type ActionResult } from "@/lib/result";

const ACCOUNT_PATH = "/settings/account";

export async function changeNameAction(input: ChangeNameInput): Promise<ActionResult<{ name: string }>> {
  return runAction(async () => {
    const { name } = changeNameSchema.parse(input);
    await requireUser();
    assertNotDemo();
    const auth = await getAuth();
    const requestHeaders = await headers();
    await callAuthApi(() => auth.api.updateUser({ body: { name }, headers: requestHeaders }));
    // The name may appear in the app shell too.
    revalidatePath("/", "layout");
    return { name };
  });
}

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  return runAction(async () => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(input);
    await requireUser();
    assertNotDemo();
    const auth = await getAuth();
    const requestHeaders = await headers();
    // Signs out all other devices; nextCookies() stores the fresh session cookie for this one.
    await callAuthApi(
      () =>
        auth.api.changePassword({
          body: { currentPassword, newPassword, revokeOtherSessions: true },
          headers: requestHeaders,
        }),
      { INVALID_PASSWORD: "currentPassword", PASSWORD_TOO_SHORT: "newPassword", PASSWORD_TOO_LONG: "newPassword" },
    );
    revalidatePath(ACCOUNT_PATH);
  });
}

/** Form action (works without JS): ends the session and goes to /login. */
export async function signOutAction(): Promise<void> {
  const auth = await getAuth();
  const requestHeaders = await headers();
  try {
    await auth.api.signOut({ headers: requestHeaders });
  } catch {
    // Session already gone: clear whatever cookies are left.
    clearAuthCookies(await cookies());
  }
  redirect(LOGIN_PATH);
}

export async function deleteAccountAction(input: DeleteAccountInput): Promise<ActionResult> {
  return runAction(async () => {
    const { password } = deleteAccountSchema.parse(input);
    const ctx = await getServiceContext();
    assertNotDemo();
    const auth = await getAuth();
    const requestHeaders = await headers();
    await callAuthApi(() => auth.api.verifyPassword({ body: { password }, headers: requestHeaders }), {
      INVALID_PASSWORD: "password",
    });

    await deleteAccount(ctx); // cascades sessions, credentials and all user data
    clearAuthCookies(await cookies());
    redirect(`${LOGIN_PATH}?deleted=1`);
  });
}
