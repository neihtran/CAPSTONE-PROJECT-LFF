import React from "react";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import type { Metadata } from "next";

import { getClip, incrementClipView } from "@/lib/clip-service";
import { ClipPlayer } from "@/components/clips/clip-player";
import { UserAvatar } from "@/components/user-avatar";
import Link from "next/link";

interface PageProps {
  params: { clipId: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const clip = await getClip(params.clipId);
  if (!clip) return { title: "Clip không tồn tại" };

  const thumbnail = clip.thumbnail ?? clip.stream.thumbnailUrl;
  const url = `/clips/${clip.id}`;

  return {
    title: `${clip.title} — @${clip.stream.user.username}`,
    description: `Clip từ @${clip.stream.user.username}`,
    openGraph: {
      title: clip.title,
      description: `Clip từ @${clip.stream.user.username}`,
      images: thumbnail ? [{ url: thumbnail }] : undefined,
      type: "video.other",
      url,
    },
    twitter: {
      card: "player",
      title: clip.title,
      description: `Clip từ @${clip.stream.user.username}`,
      images: thumbnail ? [thumbnail] : undefined,
    },
  };
}

/**
 * /clips/[clipId] — clip detail page với HLS player + metadata.
 *
 * Increment view count fire-and-forget khi load trang.
 * Embed-friendly: cho phép nhúng qua iframe (qua metadata openGraph).
 */
export default async function ClipDetailPage({ params: { clipId } }: PageProps) {
  const clip = await getClip(clipId);
  if (!clip) notFound();

  // Increment view (fire-and-forget — không await để UX nhanh hơn).
  incrementClipView(clipId);

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <ClipPlayer
        clipId={clip.id}
        videoUrl={clip.videoUrl}
        startTime={clip.startTime}
        endTime={clip.endTime}
        thumbnail={clip.thumbnail ?? clip.stream.thumbnailUrl}
        title={clip.title}
      />

      <div className="space-y-3">
        <h1 className="text-2xl font-bold">{clip.title}</h1>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-x-3">
            <Link
              href={`/${clip.stream.user.username}`}
              className="flex items-center gap-x-2 hover:underline"
            >
              <UserAvatar
                username={clip.stream.user.username}
                imageUrl={clip.stream.user.imageUrl}
                isLive={false}
              />
              <span className="font-medium text-foreground">
                @{clip.stream.user.username}
              </span>
            </Link>
            <span>·</span>
            <span>
              {formatDistanceToNow(new Date(clip.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>

          <div className="flex items-center gap-x-4">
            <span>👁 {clip.viewCount.toLocaleString()} lượt xem</span>
            {clip.isFeatured && (
              <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-600 border border-yellow-500/30">
                ⭐ Featured
              </span>
            )}
          </div>
        </div>

        <div className="pt-4 border-t text-sm">
          <p className="text-muted-foreground">Được tạo bởi</p>
          <Link
            href={`/${clip.creator.username}`}
            className="font-medium hover:underline"
          >
            @{clip.creator.username}
          </Link>
        </div>
      </div>
    </div>
  );
}
