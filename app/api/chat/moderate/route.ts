import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs";

import { moderateMessage } from "@/lib/ai-moderation-service";
import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";
import { saveChatMessage } from "@/lib/chat-service";
import { enforceRateLimit } from "@/lib/ratelimit";

/** Max length 1 chat message — khớp với maxLength ở chat-form.tsx (client). */
const MAX_MESSAGE_LENGTH = 500;

/**
 * POST /api/chat/moderate
 *
 * Body: { text: string, hostIdentity: string }
 * Response: { flagged: boolean, categories: string[] }
 *
 * ĐÂY LÀ "BOTH-SIDE GATE": vừa moderate vừa persist.
 *
 * Luồng:
 *  1. Auth check — viewer/host phải đăng nhập (Clerk) để biết userId (cần cho FK).
 *  2. Server check stream.isChatEnabled — chặn TRƯỚC khi gọi OpenAI nếu streamer
 *     đã tắt chat. Status 423 Locked cho client biết lý do.
 *  3. OpenAI Moderation kiểm tra nội dung.
 *  4. Nếu sạch + authenticated → persist ChatMessage vào DB.
 *     Persist ở server (không phải ở client) vì:
 *       - Đảm bảo 1 message gửi = 1 row, chống double-write do race condition.
 *       - Có thể mở rộng thêm (analytics, ban user, ...).
 *
 * Sau khi respond 200, client sẽ tự gọi `useChat().send()` để broadcast qua
 * LiveKit DataChannel — đây chỉ là UI propagation, DB là nguồn chính.
 *
 * Defense-in-depth:
 *   - Layer 1 (Client): useChatEnabled + toast.error.
 *   - Layer 2 (Server API): check isChatEnabled + persist.
 *   - Layer 3 (LiveKit): có thể set canPublishData permission (nâng cao).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text : "";
    const hostIdentity =
      typeof body?.hostIdentity === "string" ? body.hostIdentity : null;

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Tin nhắn rỗng" },
        { status: 400 }
      );
    }

    // ── Validate length — chặn spam tin nhắn siêu dài ──
    if (text.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          error: `Tin nhắn quá dài (tối đa ${MAX_MESSAGE_LENGTH} ký tự)`,
        },
        { status: 400 }
      );
    }

    // ── Rate limit per-user (sliding window 10/10s) ──
    const externalUser = await currentUser();
    if (!externalUser?.id) {
      return NextResponse.json(
        { error: "Bạn cần đăng nhập để gửi tin nhắn" },
        { status: 401 }
      );
    }

    try {
      await enforceRateLimit(`chat:moderate:${externalUser.id}`);
    } catch (error) {
      // enforceRateLimit throws khi vượt limit.
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Bạn đang gửi quá nhanh. Vui lòng thử lại sau.",
          code: "RATE_LIMIT",
        },
        { status: 429 }
      );
    }

    // ── Resolve viewer userId từ Clerk id ──
    const self = await db.user.findUnique({
      where: { externalUserId: externalUser.id },
      select: { id: true },
    });
    if (!self) {
      return NextResponse.json(
        { error: "Người dùng không tồn tại" },
        { status: 404 }
      );
    }

    // ── Server-side gate: chặn nếu streamer đã tắt chat ──
    if (!hostIdentity) {
      return NextResponse.json(
        { error: "Thiếu thông tin stream", code: "MISSING_HOST" },
        { status: 400 }
      );
    }

    const stream = await db.stream.findUnique({
      where: { userId: hostIdentity },
      select: { id: true, isChatEnabled: true },
    });

    if (!stream) {
      return NextResponse.json(
        { error: "Stream không tồn tại" },
        { status: 404 }
      );
    }

    if (!stream.isChatEnabled) {
      return NextResponse.json(
        {
          error: "Chat đã bị chủ kênh tắt",
          code: "CHAT_DISABLED",
        },
        { status: 423 }
      );
    }

    // ── AI moderation ──
    const result = await moderateMessage(text);

    if (result.flagged) {
      return NextResponse.json(result, { status: 200 });
    }

    // ── Persist vào DB ──
    await saveChatMessage(stream.id, self.id, text.trim());

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[api/chat/moderate] Lỗi:", error);
    return NextResponse.json(
      { error: "Không thể kiểm tra nội dung tin nhắn" },
      { status: 500 }
    );
  }
}
