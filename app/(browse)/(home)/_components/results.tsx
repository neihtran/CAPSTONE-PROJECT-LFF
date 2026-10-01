import React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { getStreams } from "@/lib/feed-service";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";

import { ResultCard, ResultCardSkeleton } from "../result-card";

type ClipResultItem = {
  id: string;
  title: string;
  thumbnail: string | null;
  isLive: boolean;
  videoUrl: string;
  viewCount: number;
  createdAt: string;
  creator: { id: string; username: string; imageUrl: string };
  stream: {
    id: string;
    name: string;
    user: { id: string; username: string; imageUrl: string };
  };
};

export async function Results({
  type = "streams",
  items: propItems,
}: {
  type?: "streams" | "clips";
  items?: ClipResultItem[];
}) {
  // Clips mode: nhận items prop. Streams mode: query DB.
  if (type === "clips") {
    const items = propItems ?? [];
    if (items.length === 0) {
      return (
        <div className="text-muted-foreground text-sm">
          Chưa có clip nào.
        </div>
      );
    }
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {items.map((clip) => (
          <Link
            key={clip.id}
            href={`/clips/${clip.id}`}
            legacyBehavior
          >
            <a className="group block space-y-2">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
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
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded">
                  👁 {clip.viewCount.toLocaleString()}
                </div>
              </div>
              <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                {clip.title}
              </h3>
              <div className="flex items-center gap-x-2 text-xs text-muted-foreground">
                <UserAvatar
                  username={clip.stream.user.username}
                  imageUrl={clip.stream.user.imageUrl}
                  isLive={false}
                />
                <span className="truncate">@{clip.stream.user.username}</span>
              </div>
            </a>
          </Link>
        ))}
      </div>
    );
  }

  // Streams mode (default).
  const data = await getStreams();
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">
        Những Stream bạn có thể thích
      </h2>
      {data.length === 0 && (
        <div className="text-muted-foreground text-sm">
          Không tìm thấy Stream nào.
        </div>
      )}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {data.map((result) => (
          <ResultCard key={result.id} data={result} />
        ))}
      </div>
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-[290px] mb-4" />
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {[...Array(4)].map((_, i) => (
          <ResultCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
