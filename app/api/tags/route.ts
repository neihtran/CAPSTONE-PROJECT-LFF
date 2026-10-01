import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";
import { setStreamTags, upsertManyTags } from "@/lib/tag-service";
import { enforceRateLimit } from "@/lib/ratelimit";

/**
 * POST /api/tags
 *
 * Body: { streamId?: string, tags: string[] }
 *
 * Nếu có streamId → set tags cho stream (caller là owner).
 * Nếu không có → chỉ upsert tags (dùng cho autocomplete caching).
 */

const TagsBodySchema = z.object({
  streamId: z.string().uuid().optional(),
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(20, "Tối đa 20 tags"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = TagsBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Input không hợp lệ",
        },
        { status: 400 }
      );
    }

    const { streamId, tags } = parsed.data;

    // Nếu set tags cho stream → auth + ownership check.
    if (streamId) {
      const self = await getSelf();

      // Rate limit per stream update.
      await enforceRateLimit(`tags:update:${self.id}`);

      const stream = await db.stream.findUnique({
        where: { id: streamId },
        select: { userId: true },
      });

      if (!stream) {
        return NextResponse.json(
          { error: "Stream không tồn tại" },
          { status: 404 }
        );
      }

      if (stream.userId !== self.id) {
        return NextResponse.json(
          { error: "Bạn không có quyền edit stream này" },
          { status: 403 }
        );
      }

      await setStreamTags(streamId, tags);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Không có streamId → chỉ upsert tags cho autocomplete warming.
    const result = await upsertManyTags(tags);
    return NextResponse.json(
      { tags: result },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/tags] Lỗi:", error);
    if (error instanceof Error && error.message.includes("rate")) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return NextResponse.json(
      { error: "Không thể xử lý tags" },
      { status: 500 }
    );
  }
}
