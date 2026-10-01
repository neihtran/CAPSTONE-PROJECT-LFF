"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { updateStreamCategories } from "@/actions/stream-categories";

/**
 * Streamer chọn tối đa 5 categories cho stream của mình.
 *
 * Server data: truyền vào qua props `initialCategories` (đã load ở parent
 * server component qua getAllCategories).
 *
 * Submit flow: gọi server action `updateStreamCategories` → revalidate page.
 */

export type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

const MAX_CATEGORIES = 5;

export function CategoryPicker({
  initialCategories,
  initialSelectedIds = [],
}: {
  initialCategories: CategoryOption[];
  initialSelectedIds?: string[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  // Track dirty state để không gọi action khi user chưa thay đổi gì.
  const [isDirty, setIsDirty] = useState(false);

  const filteredCategories = search.trim()
    ? initialCategories.filter((cat) =>
        cat.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : initialCategories;

  const toggle = (id: string) => {
    setIsDirty(true);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      // Limit tối đa 5 categories.
      if (prev.length >= MAX_CATEGORIES) {
        toast.warning(`Chỉ có thể chọn tối đa ${MAX_CATEGORIES} categories`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSave = () => {
    startTransition(() => {
      updateStreamCategories(selectedIds)
        .then(() => {
          toast.success("Đã cập nhật categories");
          setIsDirty(false);
        })
        .catch((error) =>
          toast.error(
            error instanceof Error
              ? error.message
              : "Không thể cập nhật, vui lòng thử lại"
          )
        );
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Categories</h3>
        <p className="text-sm text-muted-foreground">
          Chọn tối đa {MAX_CATEGORIES} thể loại để viewer dễ tìm thấy stream
          của bạn.
        </p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm thể loại..."
        className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <div className="max-h-96 overflow-y-auto pr-2 grid gap-2 grid-cols-1 md:grid-cols-2">
        {filteredCategories.map((cat) => {
          const isSelected = selectedIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggle(cat.id)}
              disabled={isPending}
              className={cn(
                "text-left p-3 rounded-md border transition-all",
                "hover:bg-accent hover:border-accent-foreground/20",
                "focus:outline-none focus:ring-2 focus:ring-primary",
                isSelected &&
                  "border-primary bg-primary/10 ring-1 ring-primary",
                !isSelected && "border-input"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{cat.name}</span>
                {isSelected && (
                  <span className="text-xs text-primary">✓ Đã chọn</span>
                )}
              </div>
              {cat.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {cat.description}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          Đã chọn {selectedIds.length} / {MAX_CATEGORIES}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            "bg-primary text-primary-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "hover:bg-primary/90"
          )}
        >
          {isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </div>
  );
}

export function CategoryPickerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}
