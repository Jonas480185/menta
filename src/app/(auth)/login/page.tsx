import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath, SIGNUP_PATH } from "@/server/auth/redirects";
import { AuthCard, inlineLinkClass } from "../_components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const notice =
    params.expired === "1"
      ? "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an."
      : params.deleted === "1"
        ? "Dein Konto wurde gelöscht. Schön, dass du da warst."
        : undefined;

  return (
    <AuthCard
      title="Willkommen zurück"
      description="Melde dich an und mach da weiter, wo du aufgehört hast."
      footer={
        <>
          Noch kein Konto?{" "}
          <Link href={SIGNUP_PATH} className={inlineLinkClass}>
            Konto erstellen
          </Link>
        </>
      }
    >
      <LoginForm next={next} notice={notice} />
    </AuthCard>
  );
}
