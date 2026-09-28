"use client";

import { useRouter } from "next/navigation";
import { CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { copyDayAction } from "@/app/(app)/today/actions";

export function CopyYesterdayButton({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const copy = useAction(copyDayAction, {
    onSuccess: (n) => {
      toast.success(`${n} Einträge von gestern übernommen`);
      router.refresh();
    },
  });
  return (
    <Button size="sm" variant="soft" loading={copy.isPending} onClick={() => copy.execute(from, to)}>
      <CopyPlus /> Gestern kopieren
    </Button>
  );
}
