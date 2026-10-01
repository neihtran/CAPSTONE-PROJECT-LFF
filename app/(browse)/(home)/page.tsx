import React, { Suspense } from "react";
import { Metadata } from "next";

import { Results, ResultsSkeleton } from "./_components/results";
import { TopCategoriesBar } from "./_components/top-categories-bar";

export const metadata: Metadata = {
  title: "Trang chủ",
};

export default function Home() {
  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 lg:px-6 py-6 space-y-5">
      <Suspense fallback={null}>
        {/* TopCategoriesBar load riêng (server-side) → không block Results. */}
        <TopCategoriesBar />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results />
      </Suspense>
    </div>
  );
}
