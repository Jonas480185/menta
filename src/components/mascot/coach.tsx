"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissMascotAction } from "@/app/(app)/today/actions";
import type { MascotMessage } from "@/domain/engagement";
import { Milo } from "./milo";

/** Milo with a speech bubble – a functional nudge, dismissible for today. */
export function MascotCoach({ message }: { message: MascotMessage }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const dismissible = message.key !== "default";
  return (
    <section aria-live="polite" className="flex items-start gap-3 rounded-card bg-card p-4 shadow-xs animate-rise">
      <Milo mood={message.mood} size={56} className="shrink-0" />
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-body">{message.text}</p>
        {message.action && (
          <Button asChild size="sm" variant="soft" className="mt-3">
            <Link href={message.action.href}>{message.action.label}</Link>
          </Button>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          aria-label="Hinweis ausblenden"
          className="focus-ring -m-1 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          onClick={() => {
            setHidden(true);
            void dismissMascotAction(message.key);
          }}
        >
          <X className="size-4" />
        </button>
      )}
    </section>
  );
}
