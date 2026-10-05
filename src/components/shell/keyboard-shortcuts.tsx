"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { resolveShortcut, SHORTCUTS } from "./shortcuts";

function isTyping(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Keyboard key cap. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-border-strong bg-surface-inset px-1 font-sans text-[11px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Global desktop shortcuts (n, /, 1–4, w, g, ?, ⌘K) and the "?" help dialog. */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const action = resolveShortcut({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        typing: isTyping(document.activeElement),
      });
      if (!action) return;
      e.preventDefault();
      if (action.type === "help") setHelp(true);
      else if (action.type === "navigate") router.push(action.href);
      else {
        const search = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (search) search.focus();
        else router.push("/log");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Dialog open={help} onOpenChange={setHelp}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tastenkürzel</DialogTitle>
          <DialogDescription>Schneller unterwegs mit der Tastatur.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between py-2.5 text-body-sm">
              {s.label}
              <span className="flex gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k.toUpperCase()}</Kbd>
                ))}
                {s.action.type === "search" && <Kbd>⌘K</Kbd>}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
