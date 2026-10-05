"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Apple, BookOpen, ChartLine, ChefHat, Dumbbell, House, Plus, Trophy, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MiloBuddy } from "@/components/mascot/milo-buddy";
import { cn } from "@/lib/utils";
import { Kbd } from "./keyboard-shortcuts";
import { shortcutFor } from "./shortcuts";

const ITEMS = [
  { href: "/today", label: "Heute", icon: House },
  { href: "/diary", label: "Tagebuch", icon: BookOpen },
  { href: "/log", label: "Loggen", icon: Plus, primary: true },
  { href: "/progress", label: "Fortschritt", icon: ChartLine },
  { href: "/settings", label: "Profil", icon: UserRound },
] as const;

const EXTRA = [
  { href: "/recipes", label: "Rezepte", icon: ChefHat },
  { href: "/foods", label: "Eigene Lebensmittel", icon: Apple },
  { href: "/activity", label: "Aktivität & Wasser", icon: Dumbbell },
  { href: "/achievements", label: "Erfolge", icon: Trophy },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom tab bar (mobile) + sidebar (desktop). Hidden in focus flows (/log, /scan). */
export function AppNav({ userName }: { userName?: string | null }) {
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
                <li key={href} className="flex flex-col items-center">
                  <Link
                    href={href}
                    aria-label="Essen loggen"
                    className="focus-ring -mt-7 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform hover:scale-105 active:scale-90"
                  >
                    <Icon className="size-7" strokeWidth={2.5} />
                  </Link>
                  <span aria-hidden className="mt-0.5 text-caption text-muted-foreground">
                    {label}
                  </span>
                </li>
              );
            }
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring relative flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-caption transition-colors",
                    active ? "text-primary-strong" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="bottom-nav-active"
                      aria-hidden
                      className="absolute top-0.5 h-7 w-14 rounded-full bg-primary-soft"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <motion.span
                    className="relative flex h-7 items-center"
                    animate={active ? { y: [0, -3, 0] } : { y: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                  </motion.span>
                  <span className={cn("relative", active && "font-semibold")}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card/70 px-3 py-5 backdrop-blur-xl lg:flex">
        <Link href="/today" aria-label="Menta – Heute" className="focus-ring mb-6 flex w-fit items-center rounded-lg px-2.5 py-1">
          <Logo size={30} />
        </Link>

        <Link
          href="/log"
          className="focus-ring group mb-5 flex h-12 items-center gap-2.5 rounded-control bg-primary px-4 font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-105 active:scale-[0.98]"
        >
          <Plus className="size-5 transition-transform group-hover:rotate-90" strokeWidth={2.5} />
          Essen loggen
          <Kbd className="ml-auto border-transparent bg-primary-foreground/10 text-primary-foreground">N</Kbd>
        </Link>

        <nav aria-label="Hauptnavigation" className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {ITEMS.filter((i) => !("primary" in i)).map(({ href, label, icon: Icon }) => (
            <SideLink key={href} href={href} label={label} icon={Icon} active={isActive(pathname, href)} shortcut={shortcutFor(href)} />
          ))}
          <div className="mt-6 mb-1.5 px-3 text-overline text-muted-foreground uppercase">Mehr</div>
          {EXTRA.map(({ href, label, icon: Icon }) => (
            <SideLink key={href} href={href} label={label} icon={Icon} active={isActive(pathname, href)} small />
          ))}
        </nav>

        <div className="mt-4 flex items-center gap-3 rounded-card bg-surface-inset p-3">
          <MiloBuddy mood="happy" size={52} draggable={false} />
          <div className="min-w-0 text-caption text-muted-foreground">
            <p className="font-semibold text-foreground">Milo ist da</p>
            <p>
              Drück <Kbd>?</Kbd> für Kürzel
            </p>
          </div>
        </div>
        <Link
          href="/settings/account"
          className="focus-ring mt-2 flex h-12 items-center gap-3 rounded-control px-2.5 text-body-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-strong">
            {(userName ?? "?").trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1 truncate">{userName ?? "Konto"}</span>
        </Link>
      </aside>
    </>
  );
}

function SideLink({
  href,
  label,
  icon: Icon,
  active,
  shortcut,
  small,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  shortcut?: string;
  small?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-keyshortcuts={shortcut}
      className={cn(
        "focus-ring group relative flex items-center gap-3 rounded-control px-3 transition-colors",
        small ? "h-10 text-body-sm" : "h-11 text-body",
        active ? "font-semibold text-primary-strong" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          aria-hidden
          className="absolute inset-0 rounded-control bg-primary-soft"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <Icon className={cn("relative", small ? "size-4.5" : "size-5")} strokeWidth={active ? 2.25 : 1.75} />
      <span className="relative flex-1">{label}</span>
      {shortcut && (
        <Kbd className="relative opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{shortcut}</Kbd>
      )}
    </Link>
  );
}
