import React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Thumbnail, ThumbnailSkeleton } from "@/components/thumbnail";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifiedMark } from "@/components/verified-mark";
import { CategoryBadge } from "@/components/stream/category-badge";
import type { SearchResult } from "@/lib/search-service";

export function ResultCard({ data }: { data: SearchResult }) {
  return (
    <Link href={`/${data.user.username}`} legacyBehavior>
      <a className="block">
        <div className="w-full flex gap-x-4 p-2 rounded-md hover:bg-accent/50 transition-colors">
          <div className="relative h-[9rem] w-[16rem] flex-shrink-0">
            <Thumbnail
              src={data.thumbnailUrl}
              fallback={data.user.imageUrl}
              isLive={data.isLive}
              username={data.user.username}
            />
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-x-2">
              <p className="font-bold text-lg cursor-pointer hover:text-blue-500 truncate">
                {data.user.username}
              </p>
              <VerifiedMark />
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {data.name}
            </p>
            {data.user.bio && (
              <p className="text-xs text-muted-foreground line-clamp-1 italic">
                {data.user.bio}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(data.updatedAt), {
                addSuffix: true,
              })}
            </p>
            {data.categories && data.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {data.categories.slice(0, 3).map((c) => (
                  <CategoryBadge
                    key={c.category.id}
                    slug={c.category.slug}
                    name={c.category.name}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </a>
    </Link>
  );
}

export function ResultCardSkeleton() {
  return (
    <div className="w-full flex gap-x-4 p-2">
      <div className="relative h-[9rem] w-[16rem] flex-shrink-0">
        <ThumbnailSkeleton />
      </div>
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
