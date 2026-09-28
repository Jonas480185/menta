"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mealAction } from "@/app/(app)/settings/actions";

export function MealsEditor({ meals }: { meals: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const run = async (op: Parameters<typeof mealAction>[0]) => {
    const res = await mealAction(op);
    if (!res.ok) toast.error(res.error.message);
    router.refresh();
  };
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-card bg-card shadow-xs">
        {meals.map((m, i) => (
          <li key={m.id} className="flex items-center gap-2 px-3 py-2">
            <Input
              aria-label="Name der Mahlzeit"
              defaultValue={m.name}
              onBlur={(e) => e.target.value.trim() !== m.name && run({ type: "rename", id: m.id, name: e.target.value })}
              wrapperClassName="flex-1"
            />
            <Button size="icon-sm" variant="ghost" aria-label="Nach oben" disabled={i === 0} onClick={() => run({ type: "move", id: m.id, dir: -1 })}>
              <ArrowUp />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Nach unten" disabled={i === meals.length - 1} onClick={() => run({ type: "move", id: m.id, dir: 1 })}>
              <ArrowDown />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`${m.name} entfernen`} onClick={() => run({ type: "archive", id: m.id })}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void run({ type: "create", name }).then(() => setName(""));
        }}
      >
        <Input aria-label="Neue Mahlzeit" placeholder="z. B. Pre-Workout" value={name} onChange={(e) => setName(e.target.value)} wrapperClassName="flex-1" />
        <Button type="submit" variant="soft">Hinzufügen</Button>
      </form>
    </div>
  );
}
