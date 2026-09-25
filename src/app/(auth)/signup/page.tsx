import type { Metadata } from "next";
import Link from "next/link";
import { LOGIN_PATH } from "@/server/auth/redirects";
import { AuthCard, inlineLinkClass } from "../_components/auth-card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Konto erstellen" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Konto erstellen"
      description="In zwei Minuten startklar – deine Ziele richten wir direkt danach gemeinsam ein."
      footer={
        <>
          Schon ein Konto?{" "}
          <Link href={LOGIN_PATH} className={inlineLinkClass}>
            Anmelden
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
