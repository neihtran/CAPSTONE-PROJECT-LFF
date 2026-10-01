import React from "react";

import { getSearch } from "@/lib/search-service";
import { getAllCategories } from "@/lib/category-service";
import { Skeleton } from "@/components/ui/skeleton";

import { ResultCard, ResultCardSkeleton } from "./result-card";
import { SearchFiltersBar } from "./search-filters";

export async function Results({
  term,
  categorySlug,
  isLiveOnly,
}: {
  term?: string;
  categorySlug?: string;
  isLiveOnly?: boolean;
}) {
  // Lấy categories cho filter dropdown.
  const categories = await getAllCategories();

  const data = await getSearch(term, {
    categorySlug: categorySlug || undefined,
    isLive: typeof isLiveOnly === "boolean" ? isLiveOnly : undefined,
  });

  const activeFilterCount =
    (categorySlug ? 1 : 0) + (isLiveOnly ? 1 : 0);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">
        {term
          ? `Kết quả tìm kiếm cho "${term}"`
          : categorySlug
          ? `Khám phá streams`
          : "Tất cả streams"}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {data.length} {data.length === 1 ? "kết quả" : "kết quả"}
      </p>

      <SearchFiltersBar
        categories={categories}
        activeCategory={categorySlug}
        isLiveOnly={!!isLiveOnly}
        activeFilterCount={activeFilterCount}
      />

      {data.length === 0 ? (
        <p className="text text-muted-foreground text-sm mt-6">
          Không tìm thấy kết quả nào. Hãy thử bỏ filter hoặc tìm kiếm từ khóa
          khác.
        </p>
      ) : (
        <div className="flex flex-col gap-y-4 mt-6">
          {data.map((result) => (
            <ResultCard key={result.id} data={result} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-[290px] mb-2" />
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-12 w-full mb-4" />
      <div className="flex flex-col gap-y-4">
        {[...Array(4)].map((_, i) => (
          <ResultCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
