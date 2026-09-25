import type { ReactNode } from "react";

/** Heading + card wrapper used by the login and signup pages. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 text-base text-muted-foreground">{description}</p>
      </header>
      <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
        {children}
      </section>
      <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
    </>
  );
}

export const inlineLinkClass =
  "inline-flex min-h-11 items-center rounded-md px-1 font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/35";
