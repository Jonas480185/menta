import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-content space-y-4 px-gutter py-6" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-56 w-full rounded-card" />
      <Skeleton className="h-32 w-full rounded-card" />
    </main>
  );
}
