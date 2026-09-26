import { Skeleton } from "@/components/ui/skeleton";

export default function RecipeLoading() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-4 px-gutter py-6" aria-busy="true">
      <span className="sr-only">Rezept wird geladen</span>
      <div className="flex flex-col gap-3 pt-2 pb-4">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      <Skeleton className="h-80 w-full rounded-card" />
      <Skeleton className="h-56 w-full rounded-card" />
    </div>
  );
}
