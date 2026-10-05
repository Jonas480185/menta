import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Download, LogOut } from "lucide-react";
import { requireUser } from "@/server/auth/context";
import { isDemoMode } from "@/server/auth/demo";
import { buttonClass } from "@/app/(auth)/_components/button-styles";
import { signOutAction } from "./actions";
import { DeleteAccount } from "./_components/delete-account";
import { NameForm } from "./_components/name-form";
import { PasswordForm } from "./_components/password-form";

export const metadata: Metadata = { title: "Konto" };

function Section({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={
        tone === "danger"
          ? "rounded-2xl border border-destructive/40 bg-card p-5 text-card-foreground sm:p-6"
          : "rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6"
      }
    >
      <h2 id={id} className={tone === "danger" ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function AccountSettingsPage() {
  const user = await requireUser();
  const demo = isDemoMode();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/settings"
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/35"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Einstellungen
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Konto</h1>
      </header>

      <Section title="Profil" description="So wirst du in der App angesprochen.">
        <dl className="mb-5 flex flex-col gap-1">
          <dt className="text-sm font-medium text-foreground">E-Mail</dt>
          <dd className="break-all text-base text-muted-foreground">{user.email}</dd>
        </dl>
        {demo ? null : <NameForm defaultName={user.name} />}
      </Section>

      {demo ? (
        <Section title="Demo-Konto">
          <p className="text-sm text-muted-foreground">
            Du bist im gemeinsamen Demo-Konto angemeldet. Einträge, Ziele und Rezepte kannst du frei ausprobieren,
            Name, Passwort und Abmelden sind hier deaktiviert, damit die Demo für alle funktioniert.
          </p>
        </Section>
      ) : (
        <Section title="Passwort" description="Nach der Änderung wirst du auf allen anderen Geräten abgemeldet.">
          <PasswordForm email={user.email} />
        </Section>
      )}

      <Section
        title="Deine Daten"
        description="Lade alles herunter, was du hier gespeichert hast: Profil, Ziele, Mahlzeiten, Einträge, eigene Lebensmittel, Rezepte, Gewicht, Aktivitäten und Wasser, als JSON-Datei."
      >
        <a href="/settings/account/export" download className={buttonClass("secondary", "w-full sm:w-auto")}>
          <Download aria-hidden className="size-5" />
          Daten exportieren
        </a>
      </Section>

      {demo ? null : (
        <>
          <Section title="Abmelden" description="Du kannst dich jederzeit wieder anmelden.">
            <form action={signOutAction}>
              <button type="submit" className={buttonClass("secondary", "w-full sm:w-auto")}>
                <LogOut aria-hidden className="size-5" />
                Abmelden
              </button>
            </form>
          </Section>

          <Section
            title="Konto löschen"
            tone="danger"
            description="Löscht dein Konto und alle zugehörigen Daten dauerhaft. Das kann nicht rückgängig gemacht werden."
          >
            <DeleteAccount />
          </Section>
        </>
      )}
    </div>
  );
}
