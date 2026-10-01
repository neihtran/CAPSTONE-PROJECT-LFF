import React, { Suspense } from "react";
import { Metadata } from "next";

import { listTrendingClips } from "@/lib/clip-service";
import { Results, ResultsSkeleton } from "@/app/(browse)/(home)/_components/results";

export const metadata: Metadata = {
  title: "Clips nổi bật",
};

export const dynamic = "force-dynamic";

/**
 * Trang /clips — top clips trending across site.
 *
 * Tương tự trang browse nhưng cards là clips thay vì streams.
 */
export default async function ClipsPage() {
  const clips = await listTrendingClips(50);

  const items = clips.map((c) => ({
    id: c.id,
    title: c.title,
    thumbnail: c.thumbnail ?? c.stream.thumbnailUrl ?? null,
    isLive: false,
    videoUrl: c.videoUrl,
    viewCount: c.viewCount,
    createdAt: c.createdAt.toISOString(),
    creator: c.creator,
    stream: {
      id: c.stream.id,
      name: c.stream.name,
      user: c.stream.user,
    },
  }));

  return (
    <div className="h-full p-8 max-w-screen-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clips nổi bật</h1>
        <p className="text-sm text-muted-foreground">
          Top clips có lượt xem cao nhất trên toàn site.
        </p>
      </div>

      <Suspense fallback={<ResultsSkeleton />}>
        <Results type="clips" items={items} />
      </Suspense>
    </div>
  );
}
