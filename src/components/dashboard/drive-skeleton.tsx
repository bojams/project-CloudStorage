import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder shown while the drive view is hydrating.
 */
export function DriveSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/60 bg-card/50 p-4"
        >
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="mt-3 h-3.5 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
