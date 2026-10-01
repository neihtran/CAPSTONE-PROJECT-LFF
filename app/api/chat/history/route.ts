import { NextResponse } from "next/server";

import { loadChatHistory } from "@/lib/chat-service";
import { db } from "@/lib/db";

/**
 * GET /api/chat/history?streamId={userId}
 *
 * Trả về lịch sử chat gần nhất (mặc định 50 tin) của một stream.
 *
 * `streamId` ở đây thực ra là HOST USER ID (vì Stream có unique trên userId,
 * xem prisma/schema.prisma). Đặt tên streamId để khớp với convention.
 *
 * Response: { messages: Array<ReceivedChatMessageLike> }
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const streamId = url.searchParams.get("streamId");

    if (!streamId) {
      return NextResponse.json(
        { error: "Thiếu streamId", messages: [] },
        { status: 400 }
      );
    }

    const stream = await db.stream.findUnique({
      where: { userId: streamId },
      select: { id: true },
    });
    if (!stream) {
      return NextResponse.json({ messages: [] }, { status: 200 });
    }

    const messages = await loadChatHistory(stream.id, 50);

    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    console.error("[api/chat/history] Lỗi:", error);
    return NextResponse.json({ messages: [] }, { status: 500 });
  }
}
