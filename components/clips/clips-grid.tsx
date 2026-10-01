"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import {
  deleteClipAction,
  toggleClipFeaturedAction,
} from "@/actions/clips";

type ClipItem = {
  id: string;
  title: string;
  thumbnail: string | null;
  videoUrl: string;
  viewCount: number;
  createdAt: string;
  isFeatured: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  creator: { id: string; username: string; imageUrl: string };
  stream: {
    id: string;
    name: string;
    user: { id: string; username: string; imageUrl: string };
  };
};

/**
 * ClipsGrid — grid hiển thị các clips với owner controls.
 *
 * Mỗi clip card:
 *   - Thumbnail với view count overlay.
 *   - Title + creator info.
 *   - Owner controls: toggle featured + delete.
 *
 * Click → navigate to /clips/[clipId] page.
 */
export function ClipsGrid({
  clips,
  isOwner,
  currentUserId,
}: {
  clips: ClipItem[];
  isOwner: boolean;
  currentUserId: string | null;
}) {
  if (clips.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
        Chưa có clip nào.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clips.map((clip) => (
        <ClipCard
          key={clip.id}
          clip={clip}
          canModerate={isOwner || currentUserId === clip.creator.id}
          isOwner={isOwner}
        />
      ))}
    </div>
  );
}

function ClipCard({
  clip,
  canModerate,
  isOwner,
}: {
  clip: ClipItem;
  canModerate: boolean;
  isOwner: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isFeatured, setIsFeatured] = useState(clip.isFeatured);

  const handleToggleFeatured = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOwner) return;
    startTransition(async () => {
      try {
        const result = await toggleClipFeaturedAction({ clipId: clip.id });
        setIsFeatured(result.isFeatured);
        toast.success(result.isFeatured ? "Đã ghim clip" : "Đã bỏ ghim");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Không thể toggle featured"
        );
      }
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Xóa clip "${clip.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteClipAction({ clipId: clip.id });
        toast.success("Đã xóa clip");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Không thể xóa clip"
        );
      }
    });
  };

  return (
    <Link
      href={`/clips/${clip.id}`}
      className="group block space-y-2 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        {clip.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail}
            alt={clip.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No thumbnail
          </div>
        )}

        {/* Duration badge. */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded">
          {clip.duration}s
        </div>

        {/* Featured badge. */}
        {isFeatured && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-yellow-500 text-white text-xs rounded font-medium">
            ⭐ Featured
          </div>
        )}

        {/* Owner controls. */}
        {canModerate && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isOwner && (
              <button
                type="button"
                onClick={handleToggleFeatured}
                disabled={isPending}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                  isFeatured
                    ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                    : "bg-black/70 hover:bg-black/90 text-white"
                )}
                title={isFeatured ? "Bỏ ghim" : "Ghim clip"}
              >
                {isFeatured ? "★" : "☆"}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="px-2 py-0.5 rounded text-xs bg-red-500/90 hover:bg-red-600 text-white font-medium"
              title="Xóa clip"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="px-1 space-y-1">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {clip.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-x-1.5 min-w-0">
            <UserAvatar
              username={clip.creator.username}
              imageUrl={clip.creator.imageUrl}
              isLive={false}
            />
            <span className="truncate">{clip.creator.username}</span>
          </div>
          <span className="flex-shrink-0">
            {formatDistanceToNow(new Date(clip.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          👁 {clip.viewCount.toLocaleString()} lượt xem
        </p>
      </div>
    </Link>
  );
}
