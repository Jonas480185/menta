"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus, ScanBarcode, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import { quickAddAction } from "@/app/(app)/log/actions";
import type { FoodListItem, SearchResult } from "@/server/services/foods";

const SECTION_LABEL: Record<FoodListItem["section"], string> = {
  recent: "Zuletzt verwendet",
  frequent: "Häufig",
  favorite: "Favoriten",
  own: "Eigene",
  database: "Datenbank",
  external: "Weitere Ergebnisse (Open Food Facts)",
};

const cache = new Map<string, SearchResult>();

export function LogSearch({
  date,
  mealId,
  quickPicks,
}: {
  date: string;
  mealId: string;
  quickPicks: FoodListItem[];
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Desktop: start typing right away (no virtual keyboard to pop up on fine pointers).
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const quickAdd = useAction(quickAddAction, {
    onSuccess: (d) => void toast.success(`${d.name} geloggt · ${formatNumber(d.kcal)} kcal`),
  });

  useEffect(() => {
    const q = query.trim();
    if (!q || cache.has(q)) return;
    const t = setTimeout(async () => {
      setLoading(true);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}`, { signal: ac.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as SearchResult;
        cache.set(q, data);
        setResult(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") toast.error("Suche fehlgeschlagen. Bitte erneut versuchen.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const q = query.trim();
  const current = q ? (cache.get(q) ?? result) : null;
  const items = q ? (current?.items ?? []) : quickPicks;
  const detailHref = (id: string) => `/log/food/${id}?date=${date}&meal=${mealId}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Lebensmittel suchen</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Lebensmittel, Marke oder Barcode"
            aria-keyshortcuts="/"
            className="focus-ring h-12 w-full rounded-control border border-input bg-card pr-10 pl-11 text-body placeholder:text-muted-foreground"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Suche leeren"
              className="focus-ring absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
        <Button asChild variant="secondary" size="icon" aria-label="Barcode scannen">
          <Link href={`/scan?date=${date}&meal=${mealId}`}>
            <ScanBarcode />
          </Link>
        </Button>
      </div>

      {q && !cache.has(q) && (loading || !result) ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-card bg-card p-6 text-center">
          <p className="text-body text-muted-foreground">
            {query.trim() ? "Nichts gefunden." : "Noch keine zuletzt verwendeten Lebensmittel – such einfach los."}
          </p>
          {query.trim() && (
            <Button asChild variant="soft" className="mt-4">
              <Link href={`/foods/new?name=${encodeURIComponent(query.trim())}`}>Eigenes Lebensmittel anlegen</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className={cn("space-y-1", loading && "opacity-60")}>
          {items.map((item, i) => {
            const newSection = i === 0 || items[i - 1].section !== item.section;
            const s = item.serving;
            const kcal = s ? (item.per100.kcal * s.grams) / 100 : item.per100.kcal;
            return (
              <li key={item.id}>
                {newSection && (
                  <h2 className="px-1 pt-3 pb-1 text-overline text-muted-foreground">{SECTION_LABEL[item.section]}</h2>
                )}
                <div className="flex items-center gap-2 rounded-card bg-card pr-2">
                  <Link href={detailHref(item.id)} className="focus-ring flex min-h-16 flex-1 flex-col justify-center rounded-card px-4 py-2">
                    <span className="line-clamp-1 text-body font-medium">{item.name}</span>
                    <span className="line-clamp-1 text-body-sm text-muted-foreground">
                      {[item.brandName, `${formatNumber(kcal)} kcal · ${s?.label ?? `100 ${item.basis}`}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                  {(item.section === "recent" || item.section === "frequent" || item.section === "favorite") && (
                    <Button
                      size="icon-sm"
                      variant="soft"
                      aria-label={`${item.name} erneut loggen`}
                      loading={quickAdd.isPending}
                      onClick={() => quickAdd.execute({ foodId: item.id, date, mealId })}
                    >
                      <Plus />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="pt-2 text-center text-caption text-muted-foreground">
        Daten: Open Food Facts (ODbL), USDA FoodData Central
      </p>
    </div>
  );
}
