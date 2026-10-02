import React from "react";
import Link from "next/link";
import { Metadata } from "next";

import { getTrending } from "@/lib/trending-service";
import { getTrendingCategories } from "@/lib/category-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trending",
  description: "Streams đang hot nhất trên LFF — Live For Fun",
};

/**
 * /trending — Trang streams trending 24h gần nhất.
 *
 * Hiển thị:
 *   1. Top trending streams (grid).
 *   2. Top trending categories (sidebar/list).
 */
export default async function TrendingPage() {
  const [streams, categories] = await Promise.all([
    getTrending(12),
    getTrendingCategories(10),
  ]);

  return (
    <div className="p-8 max-w-screen-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Trending</h1>
        <p className="text-muted-foreground">
          Streams đang hot nhất trong 24 giờ qua. Được xếp hạng theo mức độ
          tương tác.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top trending streams — chiếm 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold">Streams hot nhất</h2>
          {streams.length === 0 ? (
            <p className="text-muted-foreground text-sm py-12 text-center">
              Chưa có stream nào trong 24 giờ qua.
            </p>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {streams.map((stream) => (
                <TrendingStreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          )}
        </div>

        {/* Top trending categories — chiếm 1/3 */}
        <aside className="space-y-4">
          <h2 className="text-xl font-semibold">Thể loại hot</h2>
          {categories.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa có dữ liệu.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat, idx) => (
                <Link
                  key={cat.id}
                  href={`/browse/${cat.slug}`}
                  className="flex items-center gap-x-3 p-3 rounded-md border bg-card hover:bg-accent transition-colors"
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cat.liveCount} đang live
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TrendingStreamCard({
  stream,
}: {
  stream: {
    id: string;
    name: string;
    thumbnailUrl: string | null;
    isLive: boolean;
    user: { username: string };
    score: number;
  };
}) {
  return (
    <Link
      href={`/${stream.user.username}`}
      className="group flex gap-x-3 p-2 rounded-md border bg-card hover:bg-accent transition-colors"
    >
      <div className="relative flex-shrink-0 w-32 aspect-video rounded-md overflow-hidden bg-muted">
        {stream.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stream.thumbnailUrl}
            alt={stream.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20" />
        )}
        {stream.isLive && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">
            LIVE
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary">
          {stream.name}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {stream.user.username}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Score: <span className="font-mono">{stream.score}</span>
        </p>
      </div>
    </Link>
  );
}
