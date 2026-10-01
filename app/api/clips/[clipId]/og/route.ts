import { NextResponse } from "next/server";

import { getClip } from "@/lib/clip-service";

/**
 * GET /api/clips/[clipId]/og — Open Graph metadata cho clip (embed share).
 *
 * Trả JSON thay vì HTML vì:
 *   - Open Graph thực sự xử lý ở page metadata (lib/metadata.ts) — đây chỉ là
 *     endpoint JSON cho dev tools / debugger.
 *   - Chia sẻ: link trực tiếp đến /clips/[clipId] sẽ có metadata đẹp từ page.tsx.
 *
 * Route này để cho phép embed qua iframe:
 *   <iframe src="/clips/[clipId]/embed" ...></iframe>
 */
export async function GET(
  _request: Request,
  { params }: { params: { clipId: string } }
) {
  const clip = await getClip(params.clipId);

  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  return NextResponse.json({
    title: clip.title,
    description: `Clip từ @${clip.stream.user.username}`,
    image: clip.thumbnail ?? clip.stream.thumbnailUrl,
    url: `/clips/${clip.id}`,
    videoUrl: clip.videoUrl,
    duration: clip.endTime - clip.startTime,
    streamer: clip.stream.user,
    creator: clip.creator,
    viewCount: clip.viewCount,
  });
}
