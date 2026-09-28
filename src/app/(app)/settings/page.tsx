import type { Metadata } from "next";
import { ChefHat, Dumbbell, Target, Trophy, User, UtensilsCrossed, Apple, Settings } from "lucide-react";
import { ListGroup, ListItem } from "@/components/ui/list";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getCurrentUser } from "@/server/auth/context";

export const metadata: Metadata = { title: "Profil" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  return (
    <main className="mx-auto w-full max-w-content space-y-6 px-gutter py-6">
      <header>
        <h1 className="text-title">Profil</h1>
        <p className="text-body text-muted-foreground">{user?.name}</p>
      </header>
      <ListGroup title="Ziele & Daten">
        <ListItem href="/settings/goals" leading={<Target className="size-5" />} title="Kalorien- & Makroziele" chevron />
        <ListItem href="/settings/profile" leading={<User className="size-5" />} title="Körperdaten & Aktivität" chevron />
        <ListItem href="/settings/meals" leading={<UtensilsCrossed className="size-5" />} title="Mahlzeiten" chevron />
      </ListGroup>
      <ListGroup title="Mehr">
        <ListItem href="/foods" leading={<Apple className="size-5" />} title="Eigene Lebensmittel & Favoriten" chevron />
        <ListItem href="/recipes" leading={<ChefHat className="size-5" />} title="Rezepte" chevron />
        <ListItem href="/activity" leading={<Dumbbell className="size-5" />} title="Aktivität & Wasser" chevron />
        <ListItem href="/achievements" leading={<Trophy className="size-5" />} title="Erfolge" chevron />
        <ListItem href="/settings/account" leading={<Settings className="size-5" />} title="Konto" chevron />
      </ListGroup>
      <section className="space-y-2">
        <h2 className="text-overline text-muted-foreground">Darstellung</h2>
        <ThemeToggle />
      </section>
    </main>
  );
}
