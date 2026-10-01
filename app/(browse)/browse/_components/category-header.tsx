import React from "react";
import Link from "next/link";

import type { Category } from "@prisma/client";

/**
 * Header cho /browse/[slug] page — hiển thị tên, description, count.
 */
export function CategoryHeader({
  category,
  streamCount,
}: {
  category: Pick<Category, "name" | "slug" | "description" | "imageUrl">;
  streamCount: number;
}) {
  return (
    <div className="flex flex-col gap-y-2 pb-4 border-b">
      <div className="flex items-center gap-x-3">
        {category.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-12 h-12 rounded-md object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center text-2xl">
            {category.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{category.name}</h1>
          <p className="text-sm text-muted-foreground">
            {streamCount} {streamCount === 1 ? "stream" : "streams"} trong thể
            loại này
          </p>
        </div>
      </div>
      {category.description && (
        <p className="text-sm text-muted-foreground max-w-2xl">
          {category.description}
        </p>
      )}
      <div className="pt-2">
        <Link
          href="/browse"
          className="text-xs text-primary hover:underline"
        >
          ← Quay lại tất cả thể loại
        </Link>
      </div>
    </div>
  );
}
