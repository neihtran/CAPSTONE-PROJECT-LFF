import { db } from "@/lib/db";

/**
 * NotificationService — quản lý notifications cho users.
 *
 * Flow:
 *   1. createNotification(input) → check preference → insert row → trigger SSE.
 *   2. listMyNotifications(userId) → phân trang.
 *   3. markRead / markAllRead.
 *   4. getUnreadCount(userId).
 *
 * Preference:
 *   - Mỗi user có 1 row NotificationPreference.
 *   - createNotification tự động check preference trước khi insert.
 *   - Nếu preference tắt → skip insert, return null.
 *
 * SSE:
 *   - createNotification gọi realtime.publish() để push real-time update
 *     tới user đang connect.
 *
 * Lưu ý: notification KHÔNG BAO GIỜ được gửi cho chính mình
 * (self-follow, self-clip → không có notification).
 */

export type NotificationType =
  | "FOLLOW"
  | "LIVE"
  | "CLIP"
  | "MODERATION"
  | "SYSTEM";

export type NotificationWithActor = {
  id: string;
  type: string;
  status: string;
  title: string;
  body: string;
  linkUrl: string | null;
  metadata: string | null;
  createdAt: Date;
  readAt: Date | null;
  actor: {
    id: string;
    username: string;
    imageUrl: string;
  } | null;
};

/**
 * Map type → preference column.
 */
const PREFERENCE_MAP: Record<NotificationType, keyof typeof PREFERENCE_COLUMNS> = {
  FOLLOW: "onFollow",
  LIVE: "onLive",
  CLIP: "onClip",
  MODERATION: "onModeration",
  SYSTEM: "onSystem",
};

const PREFERENCE_COLUMNS = {
  onFollow: "onFollow",
  onLive: "onLive",
  onClip: "onClip",
  onModeration: "onModeration",
  onSystem: "onSystem",
} as const;

/**
 * Tạo notification mới — auto-check preference + publish SSE.
 *
 * @returns notification row hoặc null nếu bị preference block.
 */
export const createNotification = async (params: {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<{ id: string } | null> => {
  const {
    recipientId,
    actorId = null,
    type,
    title,
    body,
    linkUrl = null,
    metadata = null,
  } = params;

  // Không tự notify chính mình.
  if (actorId === recipientId) return null;

  // Check preference.
  const pref = await db.notificationPreference.findUnique({
    where: { userId: recipientId },
    select: {
      onFollow: true,
      onLive: true,
      onClip: true,
      onModeration: true,
      onSystem: true,
    },
  });

  // Default nếu chưa có preference row → cho phép.
  const prefColumn = PREFERENCE_MAP[type];
  const enabled = pref ? pref[prefColumn] : true;
  if (!enabled) return null;

  const notification = await db.notification.create({
    data: {
      recipientId,
      actorId,
      type,
      title,
      body,
      linkUrl,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
    select: { id: true, type: true, status: true, title: true, body: true, linkUrl: true, createdAt: true },
  });

  // Real-time publish (lazy import để tránh circular dep).
  try {
    const { publishNotification } = await import("@/lib/realtime");
    publishNotification(recipientId, notification);
  } catch (err) {
    console.warn(
      "[createNotification] realtime publish failed:",
      err instanceof Error ? err.message : err
    );
  }

  return notification;
};

/**
 * List notifications của 1 user — phân trang.
 */
export const listMyNotifications = async (
  userId: string,
  options: { limit?: number; offset?: number; onlyUnread?: boolean } = {}
) => {
  const { limit = 20, offset = 0, onlyUnread = false } = options;

  return db.notification.findMany({
    where: {
      recipientId: userId,
      ...(onlyUnread ? { status: "UNREAD" } : {}),
    },
    include: {
      actor: {
        select: { id: true, username: true, imageUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
};

/**
 * Đếm số UNREAD — dùng cho bell badge.
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  return db.notification.count({
    where: { recipientId: userId, status: "UNREAD" },
  });
};

/**
 * Mark 1 notification là đã đọc (chỉ recipient mới được mark).
 */
export const markNotificationRead = async (params: {
  notificationId: string;
  userId: string;
}): Promise<void> => {
  const { notificationId, userId } = params;

  await db.notification.updateMany({
    where: {
      id: notificationId,
      recipientId: userId,
      status: "UNREAD",
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });
};

/**
 * Mark ALL notifications của user là đã đọc.
 */
export const markAllNotificationsRead = async (userId: string): Promise<number> => {
  const result = await db.notification.updateMany({
    where: {
      recipientId: userId,
      status: "UNREAD",
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  return result.count;
};

/**
 * Lấy preferences của user — auto-create nếu chưa có.
 */
export const getOrCreatePreferences = async (userId: string) => {
  let pref = await db.notificationPreference.findUnique({
    where: { userId },
  });

  if (!pref) {
    pref = await db.notificationPreference.create({
      data: { userId },
    });
  }

  return pref;
};

/**
 * Update preferences — partial update.
 */
export const updatePreferences = async (
  userId: string,
  updates: {
    onFollow?: boolean;
    onLive?: boolean;
    onClip?: boolean;
    onModeration?: boolean;
    onSystem?: boolean;
    emailEnabled?: boolean;
  }
) => {
  // Đảm bảo row tồn tại trước khi update.
  await getOrCreatePreferences(userId);

  return db.notificationPreference.update({
    where: { userId },
    data: updates,
  });
};

// ────────────────────────────────────────────────────────────────────────
// HELPER: Type-specific notification creators.
// Mỗi helper build title/body/linkUrl chuẩn cho type đó.
// ────────────────────────────────────────────────────────────────────────

/**
 * Helper: thông báo khi có user follow bạn.
 */
export const notifyFollow = async (params: {
  followerId: string;
  followedId: string;
  followerUsername: string;
}) => {
  return createNotification({
    recipientId: params.followedId,
    actorId: params.followerId,
    type: "FOLLOW",
    title: "Follower mới",
    body: `@${params.followerUsername} vừa follow bạn`,
    linkUrl: `/${params.followerUsername}`,
    metadata: { username: params.followerUsername },
  });
};

/**
 * Helper: thông báo cho followers khi streamer GO LIVE.
 */
export const notifyLiveStream = async (params: {
  streamerId: string;
  streamerUsername: string;
  streamName: string;
  followerIds: string[];
}) => {
  const { streamerId, streamerUsername, streamName, followerIds } = params;

  // Insert song song (không await từng cái để tăng tốc).
  const results = await Promise.all(
    followerIds
      .filter((fid) => fid !== streamerId)
      .map((fid) =>
        createNotification({
          recipientId: fid,
          actorId: streamerId,
          type: "LIVE",
          title: "🔴 Đang LIVE",
          body: `@${streamerUsername} vừa lên sóng: "${streamName}"`,
          linkUrl: `/${streamerUsername}`,
          metadata: { username: streamerUsername, streamName },
        })
      )
  );

  return results.filter(Boolean);
};

/**
 * Helper: thông báo cho streamer khi có clip tạo từ stream của họ.
 */
export const notifyClipCreated = async (params: {
  streamerId: string;
  creatorUsername: string;
  clipId: string;
  clipTitle: string;
}) => {
  return createNotification({
    recipientId: params.streamerId,
    type: "CLIP",
    title: "Clip mới",
    body: `@${params.creatorUsername} đã tạo clip "${params.clipTitle}" từ stream của bạn`,
    linkUrl: `/clips/${params.clipId}`,
    metadata: {
      clipId: params.clipId,
      username: params.creatorUsername,
    },
  });
};
