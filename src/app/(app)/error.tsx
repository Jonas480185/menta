"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-content flex-col items-center gap-4 px-gutter py-16 text-center">
      <h1 className="text-title">Da ist etwas schiefgelaufen</h1>
      <p className="text-body text-muted-foreground">Bitte versuche es noch einmal.</p>
      <Button onClick={reset}>Erneut versuchen</Button>
    </main>
  );
}
