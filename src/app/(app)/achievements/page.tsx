import type { Metadata } from "next";
import { Flame, Lock, Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Milo } from "@/components/mascot/milo";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getServiceContext } from "@/server/auth/context";
import { getStreak, listAchievements } from "@/server/services/engagement";

export const metadata: Metadata = { title: "Erfolge" };

export default async function AchievementsPage() {
  const ctx = await getServiceContext();
  const [streak, achievements] = await Promise.all([getStreak(ctx), listAchievements(ctx)]);
  const unlocked = achievements.filter((a) => a.unlockedAt).length;
  return (
    <main className="mx-auto w-full max-w-content space-y-5 px-gutter py-6">
      <PageHeader title="Erfolge" back={{ href: "/settings", label: "Profil" }} />
      <section className="flex items-center gap-4 rounded-card bg-card p-card shadow-xs">
        <Milo mood={streak.current >= 3 ? "streak" : "neutral"} size={72} />
        <div className="grid flex-1 grid-cols-3 text-center">
          <div>
            <div className="tabular text-stat-sm">{streak.current}</div>
            <div className="text-caption text-muted-foreground">Aktuelle Serie</div>
          </div>
          <div>
            <div className="tabular text-stat-sm">{streak.longest}</div>
            <div className="text-caption text-muted-foreground">Längste Serie</div>
          </div>
          <div>
            <div className="tabular text-stat-sm">{streak.consistency} %</div>
            <div className="text-caption text-muted-foreground">Beständigkeit (4 W.)</div>
          </div>
        </div>
      </section>
      <h2 className="text-heading">
        {unlocked} von {achievements.length} freigeschaltet
      </h2>
      <ul className="grid grid-cols-2 gap-3">
        {achievements.map((a) => (
          <li
            key={a.key}
            className={cn(
              "rounded-card border p-4",
              a.unlockedAt ? "border-transparent bg-primary-soft" : "border-dashed border-border bg-card text-muted-foreground",
            )}
          >
            <div className="mb-2 flex size-9 items-center justify-center rounded-full bg-card">
              {a.unlockedAt ? (a.key.startsWith("streak") ? <Flame className="size-5 text-kcal-strong" /> : <Trophy className="size-5 text-primary-strong" />) : <Lock className="size-4" />}
            </div>
            <div className="text-body font-medium text-foreground">{a.title}</div>
            <div className="text-body-sm">{a.description}</div>
            {a.unlockedAt && <div className="mt-1 text-caption">{formatDateShort(a.unlockedAt.toISOString().slice(0, 10))}</div>}
          </li>
        ))}
      </ul>
    </main>
  );
}
