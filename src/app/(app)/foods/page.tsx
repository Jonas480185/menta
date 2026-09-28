import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListItem } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { formatNumber } from "@/lib/format";
import { getServiceContext } from "@/server/auth/context";
import { listFavorites } from "@/server/services/foods";
import { listUserFoods } from "@/server/services/user-foods";

export const metadata: Metadata = { title: "Eigene Lebensmittel" };

export default async function FoodsPage() {
  const ctx = await getServiceContext();
  const [own, favs] = await Promise.all([listUserFoods(ctx), listFavorites(ctx)]);
  return (
    <main className="mx-auto w-full max-w-content space-y-6 px-gutter py-6">
      <PageHeader
        title="Lebensmittel"
        back={{ href: "/settings", label: "Profil" }}
        actions={
          <Button asChild size="sm">
            <Link href="/foods/new"><Plus /> Neu</Link>
          </Button>
        }
      />
      {own.length === 0 ? (
        <EmptyState title="Noch keine eigenen Lebensmittel" description="Leg Produkte an, die du nicht in der Datenbank findest." action={<Button asChild variant="soft"><Link href="/foods/new">Lebensmittel anlegen</Link></Button>} />
      ) : (
        <ListGroup title="Eigene">
          {own.map((f) => (
            <ListItem key={f.id} href={`/foods/${f.id}/edit`} title={f.name} description={`${formatNumber(f.kcal)} kcal / 100 ${f.nutrientBasis}${f.brandName ? ` · ${f.brandName}` : ""}`} chevron />
          ))}
        </ListGroup>
      )}
      <ListGroup title="Favoriten">
        {favs.length === 0 ? (
          <ListItem title="Noch keine Favoriten" description="Tippe beim Loggen auf den Stern." leading={<Star className="size-5" />} />
        ) : (
          favs.map((f) => (
            <ListItem key={f.id} href={`/log/food/${f.id}`} title={f.name} description={f.brandName ?? `${formatNumber(f.per100.kcal)} kcal / 100 ${f.basis}`} leading={<Star className="size-5 fill-kcal text-kcal" />} chevron />
          ))
        )}
      </ListGroup>
    </main>
  );
}
