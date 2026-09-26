"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function RecipesError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-content px-gutter py-6">
      <EmptyState
        icon={<TriangleAlert />}
        title="Rezepte konnten nicht geladen werden"
        description="Das lag nicht an dir. Versuch es bitte gleich noch einmal."
        action={<Button onClick={() => retry()}>Erneut versuchen</Button>}
        secondaryAction={
          <Button asChild variant="ghost">
            <Link href="/recipes">Zur Rezeptliste</Link>
          </Button>
        }
      />
    </div>
  );
}
