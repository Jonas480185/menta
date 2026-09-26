import { SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function RecipeNotFound() {
  return (
    <div className="mx-auto max-w-content px-gutter py-6">
      <EmptyState
        icon={<SearchX />}
        title="Rezept nicht gefunden"
        description="Vielleicht wurde es gelöscht oder der Link ist nicht mehr aktuell."
        action={
          <Button asChild>
            <Link href="/recipes">Zu deinen Rezepten</Link>
          </Button>
        }
      />
    </div>
  );
}
