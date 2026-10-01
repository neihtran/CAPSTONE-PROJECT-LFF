import React from "react";
import { notFound } from "next/navigation";

import { getUserByUsername } from "@/lib/user-service";
import { listClipsByStream } from "@/lib/clip-service";
import { currentUser } from "@clerk/nextjs";
import { ClipsGrid } from "@/components/clips/clips-grid";

interface PageProps {
  params: { username: string };
}

/**
 * /u/[username]/clips — list tất cả clips của 1 streamer.
 *
 * Phân trang qua ?page=N (mỗi page 12 clips).
 * Hiển thị clip player modal khi click.
 */
export default async function StreamerClipsPage({
  params: { username },
  searchParams,
}: PageProps & { searchParams: { page?: string; sort?: string } }) {
  const externalUser = await currentUser();
  const user = await getUserByUsername(username);

  if (!user || !user.stream) notFound();

  const page = parseInt(searchParams.page ?? "1", 10);
  const sort = (searchParams.sort ?? "popular") as "popular" | "recent";
  const isOwner = user.externalUserId === externalUser?.id;

  const clips = await listClipsByStream(user.stream.id, {
    limit: 12,
    offset: (page - 1) * 12,
    sort,
  });

  return (
    <div className="max-w-screen-2xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clips của @{username}</h1>
        <p className="text-sm text-muted-foreground">
          Tất cả clips được tạo từ stream của @{username}.
        </p>
      </div>

      <ClipsGrid
        clips={clips.map((c) => ({
          id: c.id,
          title: c.title,
          thumbnail: c.thumbnail ?? c.stream.thumbnailUrl ?? null,
          videoUrl: c.videoUrl,
          viewCount: c.viewCount,
          createdAt: c.createdAt.toISOString(),
          isFeatured: c.isFeatured,
          startTime: c.startTime,
          endTime: c.endTime,
          duration: c.endTime - c.startTime,
          creator: c.creator,
          stream: {
            id: c.stream.id,
            name: c.stream.name,
            user: c.stream.user,
          },
        }))}
        isOwner={isOwner}
        currentUserId={externalUser?.id ?? null}
      />
    </div>
  );
}
