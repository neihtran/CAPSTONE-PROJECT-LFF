import React from "react";
import Link from "next/link";
import { User } from "@prisma/client";

import { Thumbnail, ThumbnailSkeleton } from "@/components/thumbnail";
import { UserAvatar, UserAvatarSkeleton } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryBadge } from "@/components/stream/category-badge";

type ResultCardData = {
  user: User;
  isLive: boolean;
  name: string;
  thumbnailUrl: string | null;
  categories?: Array<{
    category: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
};

export function ResultCard({ data }: { data: ResultCardData }) {
  return (
    // legacyBehavior tránh hydration warning vì Next.js không tự bọc <a>.
    // Children là <a> trực tiếp chứa block-level content (được React cho phép).
    <Link href={`/${data.user.username}`} legacyBehavior>
      <a className="block">
        <div className="h-full w-full space-y-4">
          <Thumbnail
            src={data.thumbnailUrl}
            fallback={data.user.imageUrl}
            isLive={data.isLive}
            username={data.user.username}
          />
          <div className="flex gap-x-3">
            <UserAvatar
              username={data.user.username}
              imageUrl={data.user.imageUrl}
              isLive={data.isLive}
              showBadge
            />
            <div className="flex flex-col text-sm overflow-hidden flex-1 min-w-0">
              <p className="truncate font-semibold hover:text-blue-500">
                {data.name}
              </p>
              <p className="text-muted-foreground truncate">
                {data.user.username}
              </p>
              {data.categories && data.categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
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
        </div>
      </a>
    </Link>
  );
}

export function ResultCardSkeleton() {
  return (
    <div className="h-full w-full space-y-4">
      <ThumbnailSkeleton />
      <div className="flex gap-x-3">
        <UserAvatarSkeleton />
        <div className="flex flex-col gap-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
          <div className="flex gap-1 mt-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
