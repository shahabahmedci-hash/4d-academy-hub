import { Skeleton } from "@/components/ui/skeleton";

const PageSkeleton = () => {
  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      {/* Header skeleton */}
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />

      {/* Content skeleton */}
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>

        {/* Table/list skeleton */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PageSkeleton;
