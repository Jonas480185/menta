"use client";

import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteRecipeAction, duplicateRecipeAction } from "@/app/(app)/recipes/actions";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { useAction } from "@/lib/use-action";

/** Header actions on the recipe detail: edit, duplicate, delete (with confirmation). */
export function RecipeDetailActions({ recipeId, recipeName }: { recipeId: string; recipeName: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const duplicate = useAction(duplicateRecipeAction, {
    successMessage: "Rezept kopiert",
    onSuccess: (data) => router.push(`/recipes/${data.id}/edit`),
  });
  const remove = useAction(deleteRecipeAction, {
    successMessage: "Rezept gelöscht",
    onSuccess: () => router.replace("/recipes"),
  });

  return (
    <>
      <Button asChild variant="secondary" size="sm">
        <Link href={`/recipes/${recipeId}/edit`}>
          <Pencil aria-hidden="true" />
          Bearbeiten
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label="Weitere Aktionen" size="sm" variant="ghost" loading={duplicate.isPending}>
            <MoreHorizontal />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void duplicate.execute({ id: recipeId })}>
            <Copy aria-hidden="true" />
            Duplizieren
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 aria-hidden="true" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        title={`„${recipeName}“ löschen?`}
        description="Das Rezept verschwindet aus deiner Liste und der Suche. Bereits eingetragene Portionen bleiben in deinem Tagebuch erhalten."
        confirmLabel="Löschen"
        onConfirm={async () => {
          await remove.execute({ id: recipeId });
        }}
      />
    </>
  );
}
