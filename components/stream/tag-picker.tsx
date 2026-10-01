"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { updateStreamTags } from "@/actions/stream-categories";

/**
 * TagPicker — cho streamer nhập tags free-form cho stream.
 *
 * UX:
 *   - User nhập tag + Enter để add.
 *   - Click "x" trên chip để remove.
 *   - Tối đa 20 tags.
 *   - Tự động chuyển thành lowercase slug ở backend.
 *
 * Submit: gọi server action `updateStreamTags` → revalidate.
 */

const MAX_TAGS = 20;

export function TagPicker({ initialTags = [] }: { initialTags?: string[] }) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);

  const handleAdd = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setIsDirty(true);
    setTags((prev) => {
      // Không cho duplicate (case-insensitive).
      const exists = prev.some((t) => t.toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        toast.warning("Tag đã tồn tại");
        return prev;
      }
      if (prev.length >= MAX_TAGS) {
        toast.warning(`Tối đa ${MAX_TAGS} tags`);
        return prev;
      }
      return [...prev, trimmed];
    });
    setInput("");
  };

  const handleRemove = (tag: string) => {
    setIsDirty(true);
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAdd(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      // Backspace ở input rỗng → xóa tag cuối.
      handleRemove(tags[tags.length - 1]);
    }
  };

  const handleSave = () => {
    startTransition(() => {
      updateStreamTags(tags)
        .then(() => {
          toast.success("Đã cập nhật tags");
          setIsDirty(false);
        })
        .catch((error) =>
          toast.error(
            error instanceof Error
              ? error.message
              : "Không thể cập nhật tags"
          )
        );
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Tags</h3>
        <p className="text-sm text-muted-foreground">
          Thêm tối đa {MAX_TAGS} tags để viewer tìm stream của bạn qua search.
          Nhấn Enter sau mỗi tag.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 min-h-12 p-3 border rounded-md bg-background">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              disabled={isPending}
              className="hover:text-primary/70 transition-colors disabled:opacity-50"
              aria-label={`Xóa tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input && handleAdd(input)}
          disabled={isPending || tags.length >= MAX_TAGS}
          placeholder={
            tags.length === 0
              ? "Vd: league-of-legends, ranked, vietnamese..."
              : tags.length >= MAX_TAGS
              ? `Đã đạt tối đa ${MAX_TAGS} tags`
              : "Thêm tag..."
          }
          className="flex-1 min-w-32 px-2 py-1 text-sm bg-transparent focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          Đã thêm {tags.length} / {MAX_TAGS}
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

export function TagPickerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
