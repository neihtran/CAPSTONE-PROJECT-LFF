"use client";

import React, { useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Filter bar cho search page — user có thể lọc theo category + isLive.
 *
 * Filter changes → cập nhật URL params → server re-render với filter mới.
 */
export function SearchFiltersBar({
  categories,
  activeCategory,
  isLiveOnly,
  activeFilterCount,
}: {
  categories: CategoryOption[];
  activeCategory?: string;
  isLiveOnly: boolean;
  activeFilterCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [showAllCategories, setShowAllCategories] = useState(false);

  // Hiển thị 8 categories nổi bật + nút "Xem thêm".
  const visibleCategories = showAllCategories
    ? categories
    : categories.slice(0, 8);

  const updateFilters = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const queryString = params.toString();
      startTransition(() => {
        router.push(`${pathname}${queryString ? `?${queryString}` : ""}`);
      });
    },
    [router, pathname, searchParams]
  );

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category");
    params.delete("isLive");
    const queryString = params.toString();
    startTransition(() => {
      router.push(`${pathname}${queryString ? `?${queryString}` : ""}`);
    });
    toast.success("Đã xóa tất cả filter");
  };

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <span className="text-sm font-medium">Bộ lọc</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Xóa tất cả
          </button>
        )}
      </div>

      {/* Filter: isLive */}
      <div className="flex items-center gap-x-2">
        <input
          id="filter-isLive"
          type="checkbox"
          checked={isLiveOnly}
          onChange={(e) =>
            updateFilters("isLive", e.target.checked ? "1" : null)
          }
          className="rounded"
        />
        <label htmlFor="filter-isLive" className="text-sm cursor-pointer">
          Chỉ hiển thị stream đang live
        </label>
      </div>

      {/* Filter: Category chips */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Thể loại:</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateFilters("category", null)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              !activeCategory
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-input hover:bg-accent"
            )}
          >
            Tất cả
          </button>
          {visibleCategories.map((cat) => {
            const isActive = cat.slug === activeCategory;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => updateFilters("category", cat.slug)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-input hover:bg-accent"
                )}
              >
                {cat.name}
              </button>
            );
          })}
          {categories.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllCategories((v) => !v)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border bg-background border-input hover:bg-accent"
            >
              {showAllCategories ? "Thu gọn" : `+${categories.length - 8} thêm`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
