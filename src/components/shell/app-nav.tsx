"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChartLine, House, Plus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/today", label: "Heute", icon: House },
  { href: "/diary", label: "Tagebuch", icon: BookOpen },
  { href: "/log", label: "Loggen", icon: Plus, primary: true },
  { href: "/progress", label: "Fortschritt", icon: ChartLine },
  { href: "/settings", label: "Profil", icon: UserRound },
] as const;

const EXTRA = [
  { href: "/recipes", label: "Rezepte" },
  { href: "/foods", label: "Eigene Lebensmittel" },
  { href: "/activity", label: "Aktivität & Wasser" },
  { href: "/achievements", label: "Erfolge" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom tab bar (mobile) + sidebar (desktop). Hidden in focus flows (/log, /scan). */
export function AppNav() {
  const pathname = usePathname();
  const focus = pathname.startsWith("/log") || pathname.startsWith("/scan");

  return (
    <>
      <nav
        aria-label="Hauptnavigation"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-safe backdrop-blur-lg lg:hidden",
          focus && "hidden",
        )}
      >
        <ul className="mx-auto flex h-bottom-nav max-w-content items-center justify-around px-2">
          {ITEMS.map(({ href, label, icon: Icon, ...rest }) => {
            const active = isActive(pathname, href);
            if ("primary" in rest) {
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-label={label}
                    className="focus-ring flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
                  >
                    <Icon className="size-6" strokeWidth={2.25} />
                  </Link>
                </li>
              );
            }
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-md text-caption",
                    active ? "text-primary-strong" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card px-4 py-6 lg:flex">
        <Link href="/today" className="mb-8 flex items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/menta-mark.svg" alt="" className="size-8" />
          <span className="text-heading font-semibold">Menta</span>
        </Link>
        <nav aria-label="Hauptnavigation" className="flex flex-1 flex-col gap-1">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "focus-ring flex h-11 items-center gap-3 rounded-control px-3 text-body",
                isActive(pathname, href)
                  ? "bg-primary-soft font-medium text-primary-strong"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
          <div className="mt-6 mb-2 px-3 text-overline text-muted-foreground">Mehr</div>
          {EXTRA.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "focus-ring flex h-10 items-center rounded-control px-3 text-body-sm",
                isActive(pathname, href) ? "text-primary-strong" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
