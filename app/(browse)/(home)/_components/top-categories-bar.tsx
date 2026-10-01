import React from "react";
import Link from "next/link";

import { getAllCategories } from "@/lib/category-service";
import { cn } from "@/lib/utils";

/**
 * Top Categories Bar — hiển thị categories phổ biến ở đầu trang home.
 *
 * UX:
 *   - Mobile (<md): horizontal scroll pills.
 *   - Desktop: wrap pills (no scroll, no overflow).
 *
 * Lý do trước đây xấu: flex với overflow-x-auto chạy cả desktop → xuất hiện
 * thanh scroll khi không cần và categories bị cắt giữa chừng.
 */
export async function TopCategoriesBar({
  className,
}: {
  className?: string;
}) {
  const categories = await getAllCategories();

  if (categories.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
          Thể loại phổ biến
        </h2>
        <Link
          href="/browse"
          className="text-xs text-primary hover:underline whitespace-nowrap"
        >
          Xem tất cả →
        </Link>
      </div>

      {/* Wrap pills, scroll chỉ trên mobile khi tràn. */}
      <div className="flex flex-wrap gap-2 md:gap-2.5">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/browse/${cat.slug}`}
            className="px-3.5 py-1.5 rounded-full border bg-card hover:bg-accent hover:border-primary transition-colors text-sm font-medium whitespace-nowrap"
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
