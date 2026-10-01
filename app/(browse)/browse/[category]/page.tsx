import React from "react";
import { notFound } from "next/navigation";

import { getCategoryBySlug, getStreamsByCategory } from "@/lib/category-service";
import { getSelf } from "@/lib/auth-service";
import { ResultCard } from "../../(home)/result-card";
import { CategoryHeader } from "../_components/category-header";

export const dynamic = "force-dynamic";

/**
 * Trang /browse/[slug] — list streams của 1 category.
 *
 * Ví dụ: /browse/gaming, /browse/music, /browse/coding.
 */
export default async function CategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const slug = params.category;

  const category = await getCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  let viewerId: string | null = null;
  try {
    const self = await getSelf();
    viewerId = self.id;
  } catch {
    viewerId = null;
  }

  const streams = await getStreamsByCategory(slug, { viewerId });

  return (
    <div className="p-6 space-y-6">
      <CategoryHeader category={category} streamCount={streams.length} />

      {streams.length === 0 ? (
        <div className="text-muted-foreground text-sm py-12 text-center">
          Chưa có stream nào trong thể loại này.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {streams.map((result) => (
            <ResultCard key={result.id} data={result} />
          ))}
        </div>
      )}
    </div>
  );
}
