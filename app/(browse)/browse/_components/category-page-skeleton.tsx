import React from "react";

import { ResultCardSkeleton } from "../../(home)/result-card";

/**
 * Skeleton component cho /browse/[category] page.
 * Tách riêng khỏi page.tsx vì Next.js App Router page KHÔNG được export
 * named function khác ngoài `default`.
 */
export function CategoryPageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-96 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {[...Array(8)].map((_, i) => (
          <ResultCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
