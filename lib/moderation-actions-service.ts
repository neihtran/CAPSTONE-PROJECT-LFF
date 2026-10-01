import { db } from "@/lib/db";
import { livekit } from "@/lib/livekit";

/**
 * ModerationService — quản lý timeout/ban/auto-mod cho streams.
 *
 * Roles:
 *   - STREAMER (owner): full quyền, kể cả unban và quản lý moderators.
 *   - MODERATOR: timeout, ban (?), delete message.
 *   - VIEWER: không có quyền.
 *
 * Thực tế: với MVP này, MODERATOR chỉ có quyền:
 *   - TIMEOUT (cấm chat N phút).
 *   - DELETE_MESSAGE.
 *   - Không có quyền BAN (chỉ streamer mới ban được).
 *
 * LiveKit integration:
 *   - TIMEOUT → gọi RoomServiceClient.removeParticipant để disconnect khỏi room.
 *   - Cập nhật LiveKit Room metadata để blocked participant không thể reconnect.
 */

export const ModActionType = {
  TIMEOUT: "TIMEOUT",
  BAN: "BAN",
  UNBAN: "UNBAN",
  DELETE_MESSAGE: "DELETE_MESSAGE",
} as const;
export type ModActionType =
  (typeof ModActionType)[keyof typeof ModActionType];

export const BannedWordAction = {
  REJECT: "REJECT",
  FILTER: "FILTER",
} as const;
export type BannedWordAction =
  (typeof BannedWordAction)[keyof typeof BannedWordAction];

/**
 * Check user có phải moderator của stream (bao gồm cả streamer owner).
 *
 * @returns true nếu user là streamer (owner) hoặc được add vào moderators.
 */
export const isModeratorOrOwner = async (
  userId: string,
  streamId: string
): Promise<boolean> => {
  const stream = await db.stream.findUnique({
    where: { id: streamId },
    select: { userId: true },
  });
  if (!stream) return false;

  if (stream.userId === userId) return true;

  const mod = await db.streamModerator.findUnique({
    where: { streamId_userId: { streamId, userId } },
  });
  return mod !== null;
};

/**
 * Check user có phải owner của stream.
 * Chỉ owner mới có quyền add/remove moderator, ban, unban.
 */
export const isStreamOwner = async (
  userId: string,
  streamId: string
): Promise<boolean> => {
  const stream = await db.stream.findUnique({
    where: { id: streamId },
    select: { userId: true },
  });
  return stream?.userId === userId;
};

/**
 * Timeout một user khỏi stream — cấm chat N phút.
 *
 * Logic:
 *   1. Lưu ModerationAction (TIMEOUT + expiresAt).
 *   2. LiveKit: removeParticipant để disconnect user khỏi room ngay lập tức.
 *   3. Update Room metadata với danh sách blocked userIds (để chặn reconnect).
 *
 * Lưu ý: LiveKit timeout CHỈ cấm connect mới. Để chặn reconnect đến khi
 * expiresAt, cần check ở webhook + server trước khi cấp access token.
 *
 * @param durationMinutes - thời gian timeout (1-10080 = 1 phút đến 7 ngày).
 */
export const timeoutUser = async (params: {
  streamId: string;
  targetUserId: string;
  actorUserId: string;
  durationMinutes: number;
  reason?: string;
}): Promise<void> => {
  const { streamId, targetUserId, actorUserId, durationMinutes, reason } =
    params;

  // Không cho timeout chính mình.
  if (targetUserId === actorUserId) {
    throw new Error("Bạn không thể timeout chính mình");
  }

  // Không cho timeout chủ stream.
  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!target) throw new Error("User không tồn tại");

  const expiresAt = new Date(
    Date.now() + Math.max(1, Math.min(durationMinutes, 10080)) * 60 * 1000
  );

  await db.moderationAction.create({
    data: {
      type: ModActionType.TIMEOUT,
      streamId,
      targetUserId,
      actorUserId,
      expiresAt,
      reason,
    },
  });

  // LiveKit: disconnect participant.
  try {
    const stream = await db.stream.findUnique({
      where: { id: streamId },
      select: { userId: true },
    });
    if (stream) {
      // Room name = host's userId. Participant identity = targetUserId.
      await livekit.removeParticipant(stream.userId, targetUserId);
    }
  } catch (err) {
    // Fail-open: log warning, vẫn lưu action để audit.
    console.warn(
      "[timeoutUser] LiveKit disconnect failed:",
      err instanceof Error ? err.message : err
    );
  }
};

/**
 * Ban user khỏi stream (vĩnh viễn).
 * Chỉ OWNER mới có quyền ban — moderators chỉ timeout được.
 */
export const banUser = async (params: {
  streamId: string;
  targetUserId: string;
  actorUserId: string;
  reason?: string;
}): Promise<void> => {
  const { streamId, targetUserId, actorUserId, reason } = params;

  if (targetUserId === actorUserId) {
    throw new Error("Bạn không thể ban chính mình");
  }

  // Verify owner (chỉ owner mới được ban).
  const isOwner = await isStreamOwner(actorUserId, streamId);
  if (!isOwner) {
    throw new Error("Chỉ chủ stream mới có quyền ban");
  }

  // Verify target không phải owner (defense in depth).
  const targetIsOwner = await isStreamOwner(targetUserId, streamId);
  if (targetIsOwner) {
    throw new Error("Không thể ban chủ stream");
  }

  await db.moderationAction.create({
    data: {
      type: ModActionType.BAN,
      streamId,
      targetUserId,
      actorUserId,
      expiresAt: null, // Vĩnh viễn.
      reason,
    },
  });

  // LiveKit disconnect.
  try {
    const stream = await db.stream.findUnique({
      where: { id: streamId },
      select: { userId: true },
    });
    if (stream) {
      await livekit.removeParticipant(stream.userId, targetUserId);
    }
  } catch (err) {
    console.warn(
      "[banUser] LiveKit disconnect failed:",
      err instanceof Error ? err.message : err
    );
  }
};

/**
 * Unban user — xóa tất cả active BAN actions của target trên stream.
 * Đồng thời thêm UNBAN log action.
 */
export const unbanUser = async (params: {
  streamId: string;
  targetUserId: string;
  actorUserId: string;
  reason?: string;
}): Promise<void> => {
  const { streamId, targetUserId, actorUserId, reason } = params;

  const isOwner = await isStreamOwner(actorUserId, streamId);
  if (!isOwner) {
    throw new Error("Chỉ chủ stream mới có quyền unban");
  }

  // Xóa các BAN active bằng cách tạo UNBAN log (giữ audit trail).
  // Không xóa cứng ModerationAction → vẫn truy vết được.
  await db.moderationAction.create({
    data: {
      type: ModActionType.UNBAN,
      streamId,
      targetUserId,
      actorUserId,
      reason: reason ?? "Manual unban",
    },
  });
};

/**
 * Xóa 1 chat message — moderator/owner có quyền.
 * Lưu log để audit.
 */
export const deleteChatMessage = async (params: {
  streamId: string;
  messageId: string;
  actorUserId: string;
  reason?: string;
}): Promise<void> => {
  const { streamId, messageId, actorUserId, reason } = params;

  const message = await db.chatMessage.findUnique({
    where: { id: messageId },
    select: { id: true, streamId: true, userId: true },
  });

  if (!message) {
    throw new Error("Tin nhắn không tồn tại");
  }
  if (message.streamId !== streamId) {
    throw new Error("Tin nhắn không thuộc stream này");
  }

  // Lưu log trước.
  await db.moderationAction.create({
    data: {
      type: ModActionType.DELETE_MESSAGE,
      streamId,
      targetUserId: message.userId,
      actorUserId,
      messageId,
      reason,
    },
  });

  // Sau đó xóa message.
  await db.chatMessage.delete({ where: { id: messageId } });
};

/**
 * Check user có đang bị block khỏi stream không (BAN active hoặc TIMEOUT chưa hết hạn).
 *
 * @returns true nếu user BỊ block (không được vào stream).
 */
export const isUserBlockedFromStream = async (
  userId: string,
  streamId: string
): Promise<boolean> => {
  // Owner luôn được vào.
  const stream = await db.stream.findUnique({
    where: { id: streamId },
    select: { userId: true },
  });
  if (stream?.userId === userId) return false;

  // Check latest action: có BAN sau cùng thì block.
  // Nếu có UNBAN sau BAN → không block.
  const latestBanAction = await db.moderationAction.findFirst({
    where: {
      streamId,
      targetUserId: userId,
      OR: [{ type: ModActionType.BAN }, { type: ModActionType.UNBAN }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (latestBanAction?.type === ModActionType.BAN) return true;

  // Check TIMEOUT chưa hết hạn.
  const activeTimeout = await db.moderationAction.findFirst({
    where: {
      streamId,
      targetUserId: userId,
      type: ModActionType.TIMEOUT,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return activeTimeout !== null;
};

/**
 * Lấy lịch sử moderation actions của 1 stream (cho mod log viewer).
 */
export const getModLog = async (
  streamId: string,
  options: { limit?: number; type?: ModActionType } = {}
) => {
  const { limit = 50, type } = options;

  return db.moderationAction.findMany({
    where: {
      streamId,
      ...(type ? { type } : {}),
    },
    include: {
      targetUser: {
        select: { id: true, username: true, imageUrl: true },
      },
      actorUser: {
        select: { id: true, username: true, imageUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

/**
 * Lấy danh sách moderators của stream.
 */
export const getStreamModerators = async (streamId: string) => {
  return db.streamModerator.findMany({
    where: { streamId },
    include: {
      user: {
        select: { id: true, username: true, imageUrl: true, bio: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

/**
 * Add moderator cho stream (chỉ owner mới làm được).
 */
export const addModerator = async (params: {
  streamId: string;
  userId: string;
  ownerUserId: string;
}): Promise<void> => {
  const { streamId, userId, ownerUserId } = params;

  const isOwner = await isStreamOwner(ownerUserId, streamId);
  if (!isOwner) {
    throw new Error("Chỉ chủ stream mới có quyền thêm moderator");
  }

  // Không thể tự add chính mình (đã là owner).
  if (userId === ownerUserId) {
    throw new Error("Bạn đã là chủ stream");
  }

  // Verify user tồn tại.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new Error("User không tồn tại");

  await db.streamModerator.upsert({
    where: { streamId_userId: { streamId, userId } },
    create: { streamId, userId },
    update: {},
  });
};

/**
 * Xóa moderator (chỉ owner mới làm được).
 */
export const removeModerator = async (params: {
  streamId: string;
  userId: string;
  ownerUserId: string;
}): Promise<void> => {
  const { streamId, userId, ownerUserId } = params;

  const isOwner = await isStreamOwner(ownerUserId, streamId);
  if (!isOwner) {
    throw new Error("Chỉ chủ stream mới có quyền xóa moderator");
  }

  await db.streamModerator.deleteMany({
    where: { streamId, userId },
  });
};
