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
 * Load lịch sử chat của một stream (mặc định 50 tin nhắn gần nhất).
 *
 * Trả về ASC (oldest first) để client render đúng thứ tự thời gian mà không cần sort lại.
 */
export const loadChatHistory = async (
  streamId: string,
  limit = 50
): Promise<HistoryItem[]> => {
  const rows = await db.chatMessage.findMany({
    where: { streamId },
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
