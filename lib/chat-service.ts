import { db } from "@/lib/db";

/**
 * ChatMessageService — lưu và load lịch sử chat từ DB.
 *
 * Lý do cần service này:
 *   LiveKit DataChannel không lưu lịch sử server-side. Khi client disconnect/reload,
 *   state `chatMessages` mất. Để giữ lịch sử qua refresh/toggle chat, ta persist
 *   vào DB.
 */

/**
 * Persist một chat message vào DB sau khi moderation OK.
 */
export const saveChatMessage = async (
  streamId: string,
  userId: string,
  text: string
): Promise<void> => {
  await db.chatMessage.create({
    data: {
      streamId,
      userId,
      text,
    },
  });
};

/**
 * Item trả về — format tương thích với LiveKit ReceivedChatMessage để merge.
 */
export type HistoryItem = {
  id: string;
  message: string;
  timestamp: number;
  from: { identity: string; name?: string };
};

/**
 * Load lịch sử chat của stream, CHỈ trong session đang active.
 *
 * Fix Bug 3: filter theo `openSession.startedAt` để chỉ trả về message
 * thuộc về session hiện tại (không trả message cũ từ session đã end).
 *
 * Edge cases:
 *   - Stream chưa có session active → trả về [].
 *   - Session cũ đã `endedAt != null` → bị bỏ qua.
 *   - Nếu có nhiều session mở (lỗi logic) → lấy session mới nhất.
 *
 * @param streamId - ID của stream.
 * @param limit - Số message tối đa (mặc định 50, lấy từ cuối session).
 * @returns Mảng HistoryItem ASC (oldest first).
 */
export const loadChatHistory = async (
  streamId: string,
  limit = 50
): Promise<HistoryItem[]> => {
  // Tìm session active của stream.
  // Active = endedAt IS NULL (stream đang live).
  // Lấy session mới nhất nếu có nhiều (phòng trường hợp data anomaly).
  const openSession = await db.streamSession.findFirst({
    where: { streamId, endedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  });

  // Không có session active → chat list trống.
  if (!openSession) {
    return [];
  }

  const rows = await db.chatMessage.findMany({
    where: {
      streamId,
      // CHỈ lấy message sau khi session bắt đầu.
      sentAt: { gte: openSession.startedAt },
    },
    orderBy: { sentAt: "asc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    message: row.text,
    timestamp: row.sentAt.getTime(),
    from: {
      identity: row.user.id,
      name: row.user.username,
    },
  }));
};
