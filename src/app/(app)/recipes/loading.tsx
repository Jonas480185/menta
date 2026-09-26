import { Skeleton } from "@/components/ui/skeleton";

export default function RecipesLoading() {
  return (
    <div className="mx-auto max-w-content px-gutter py-6" aria-busy="true">
      <span className="sr-only">Rezepte werden geladen</span>
      <div className="flex items-center justify-between pt-2 pb-4">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-32 rounded-sm" />
      </div>
      <div className="mt-2 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}
