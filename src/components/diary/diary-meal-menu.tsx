"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { addDays } from "@/lib/dates";
import { copyEntriesAction } from "@/app/(app)/log/actions";

/** Copy this meal to today/tomorrow, or pull the same meal from yesterday. */
export function DiaryMealMenu({ date, mealId, hasEntries }: { date: string; mealId: string; hasEntries: boolean }) {
  const router = useRouter();
  const copy = async (from: string, to: string, label: string) => {
    const res = await copyEntriesAction({ date: from, mealId }, { date: to, mealId });
    if (res.ok) {
      toast.success(res.data ? `${res.data} Einträge ${label}` : "Nichts zum Kopieren gefunden");
      router.refresh();
    } else toast.error(res.error.message);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton variant="ghost" label="Mahlzeit-Optionen">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => copy(addDays(date, -1), date, "von gestern übernommen")}>
          Von gestern übernehmen
        </DropdownMenuItem>
        {hasEntries && (
          <DropdownMenuItem onSelect={() => copy(date, addDays(date, 1), "auf morgen kopiert")}>
            Auf morgen kopieren
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
