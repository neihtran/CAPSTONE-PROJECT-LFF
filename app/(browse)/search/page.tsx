import React, { Suspense } from "react";
import { redirect } from "next/navigation";

import { Results, ResultsSkeleton } from "./_components/results";

export const dynamic = "force-dynamic";

/**
 * /search?term=...&category=...&isLive=1
 *
 * Nếu không có term VÀ không có category VÀ không có isLive → redirect về home.
 */
export default function SearchPage({
  searchParams,
}: {
  searchParams: {
    term?: string;
    category?: string;
    isLive?: string;
  };
}) {
  const term = searchParams.term?.trim();
  const category = searchParams.category?.trim();
  const isLive = searchParams.isLive === "1";

  // Cần ít nhất 1 tiêu chí để search.
  if (!term && !category && !isLive) {
    redirect("/");
  }

  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 lg:px-6 py-6">
      <Suspense fallback={<ResultsSkeleton />}>
        <Results
          term={term || undefined}
          categorySlug={category || undefined}
          isLiveOnly={isLive}
        />
      </Suspense>
    </div>
  );
}
