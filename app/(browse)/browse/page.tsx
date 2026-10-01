import React from "react";
import Link from "next/link";

import { getAllCategories } from "@/lib/category-service";

/**
 * /browse — Trang index categories.
 *
 * Hiển thị grid 20 categories, click vào sẽ vào /browse/[slug].
 */
export const dynamic = "force-dynamic";

export default async function BrowseIndexPage() {
  const categories = await getAllCategories();

  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 lg:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Khám phá theo thể loại</h1>
        <p className="text-muted-foreground">
          Chọn thể loại bạn quan tâm để xem các stream đang live.
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="text-muted-foreground text-sm py-12 text-center">
          Chưa có thể loại nào.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/browse/${cat.slug}`}
              className="group flex flex-col gap-y-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              {cat.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  className="w-full aspect-video object-cover rounded-md"
                />
              ) : (
                <div className="w-full aspect-video rounded-md bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-4xl font-bold text-primary">
                  {cat.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  {cat.name}
                </h3>
                {cat.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {cat.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
