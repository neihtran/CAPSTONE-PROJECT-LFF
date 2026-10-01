import { db } from "@/lib/db";

/**
 * ClipService — quản lý clips của streams.
 *
 * Lifecycle:
 *   - createClip: viewer tạo clip từ live stream.
 *   - getClip: lấy 1 clip.
 *   - listClipsByStream: list clips của 1 stream (public, phân trang).
 *   - listClipsByCreator: list clips do 1 user tạo.
 *   - deleteClip: streamer xóa clip của stream, hoặc creator xóa clip của mình.
 *   - incrementView: tăng viewCount (fire-and-forget).
 *   - toggleFeatured: streamer toggle isFeatured.
 *
 * Lưu ý MVP: clip videoUrl là 1 segment HLS URL. Trong production cần 1
 * background worker ghi clip từ HLS stream. Tạm thời mình tạo clip với
 * videoUrl = full HLS stream (cắt startTime/endTime).
 */

export type ClipWithRelations = {
  id: string;
  title: string;
  thumbnail: string | null;
  videoUrl: string;
  viewCount: number;
  startTime: number;
  endTime: number;
  createdAt: Date;
  isFeatured: boolean;
  streamId: string;
  creatorId: string;
  creator: {
    id: string;
    username: string;
    imageUrl: string;
  };
  stream: {
    id: string;
    name: string;
    thumbnailUrl: string | null;
    userId: string;
    user: {
      id: string;
      username: string;
      imageUrl: string;
    };
  };
};

/**
 * Tạo clip mới.
 *
 * Rules:
 *   - Phải có videoUrl (HLS URL).
 *   - title: max 200 chars.
 *   - startTime < endTime, endTime - startTime <= 5 phút (300s).
 *   - Phải login (userId).
 */
export const createClip = async (params: {
  streamId: string;
  creatorId: string;
  title: string;
  videoUrl: string;
  thumbnail?: string | null;
  startTime?: number;
  endTime?: number;
}): Promise<ClipWithRelations> => {
  const {
    streamId,
    creatorId,
    title,
    videoUrl,
    thumbnail = null,
    startTime = 0,
    endTime = 60,
  } = params;

  if (!videoUrl || !videoUrl.trim()) {
    throw new Error("videoUrl không được rỗng");
  }
  if (!title || title.length > 200) {
    throw new Error("title phải từ 1-200 ký tự");
  }
  if (startTime >= endTime) {
    throw new Error("startTime phải nhỏ hơn endTime");
  }
  if (endTime - startTime > 300) {
    throw new Error("Clip tối đa 5 phút");
  }

  // Verify stream tồn tại.
  const stream = await db.stream.findUnique({
    where: { id: streamId },
    select: { id: true },
  });
  if (!stream) throw new Error("Stream không tồn tại");

  const clip = await db.clip.create({
    data: {
      streamId,
      creatorId,
      title: title.trim(),
      videoUrl: videoUrl.trim(),
      thumbnail,
      startTime,
      endTime,
    },
    include: {
      creator: {
        select: { id: true, username: true, imageUrl: true },
      },
      stream: {
        select: {
          id: true,
          name: true,
          thumbnailUrl: true,
          userId: true,
          user: { select: { id: true, username: true, imageUrl: true } },
        },
      },
    },
  });

  // Notify streamer về clip mới (nếu creator ≠ streamer).
  try {
    const { notifyClipCreated } = await import("@/lib/notification-service");
    await notifyClipCreated({
      streamerId: clip.stream.userId,
      creatorUsername: clip.creator.username,
      clipId: clip.id,
      clipTitle: clip.title,
    });
  } catch (err) {
    console.warn("[createClip] notification failed:", err);
  }

  return clip as ClipWithRelations;
};

/**
 * Lấy 1 clip theo id.
 */
export const getClip = async (
  id: string
): Promise<ClipWithRelations | null> => {
  return db.clip.findUnique({
    where: { id },
    include: {
      creator: {
        select: { id: true, username: true, imageUrl: true },
      },
      stream: {
        select: {
          id: true,
          name: true,
          thumbnailUrl: true,
          userId: true,
          user: { select: { id: true, username: true, imageUrl: true } },
        },
      },
    },
  }) as Promise<ClipWithRelations | null>;
};

/**
 * Lấy clips của 1 stream (public, phân trang).
 * Sort mặc định: featured trước, sau đó theo viewCount.
 */
export const listClipsByStream = async (
  streamId: string,
  options: { limit?: number; offset?: number; sort?: "recent" | "popular" } = {}
) => {
  const { limit = 20, offset = 0, sort = "popular" } = options;

  const orderBy =
    sort === "popular"
      ? [{ isFeatured: "desc" as const }, { viewCount: "desc" as const }]
      : [{ isFeatured: "desc" as const }, { createdAt: "desc" as const }];

  return db.clip.findMany({
    where: { streamId },
    include: {
      creator: {
        select: { id: true, username: true, imageUrl: true },
      },
      stream: {
        select: {
          id: true,
          name: true,
          thumbnailUrl: true,
          userId: true,
          user: { select: { id: true, username: true, imageUrl: true } },
        },
      },
    },
    orderBy,
    take: limit,
    skip: offset,
  });
};

/**
 * Clips do 1 user tạo (across streams).
 */
export const listClipsByCreator = async (
  creatorId: string,
  options: { limit?: number; offset?: number } = {}
) => {
  const { limit = 20, offset = 0 } = options;

  return db.clip.findMany({
    where: { creatorId },
    include: {
      creator: {
        select: { id: true, username: true, imageUrl: true },
      },
      stream: {
        select: {
          id: true,
          name: true,
          thumbnailUrl: true,
          userId: true,
          user: { select: { id: true, username: true, imageUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
};

/**
 * Top clips across toàn site (trending).
 */
export const listTrendingClips = async (limit = 20) => {
  return db.clip.findMany({
    include: {
      creator: {
        select: { id: true, username: true, imageUrl: true },
      },
      stream: {
        select: {
          id: true,
          name: true,
          thumbnailUrl: true,
          userId: true,
          user: { select: { id: true, username: true, imageUrl: true } },
        },
      },
    },
    orderBy: { viewCount: "desc" },
    take: limit,
  });
};

/**
 * Tăng viewCount — fire-and-forget, không chặn user.
 */
export const incrementClipView = async (clipId: string): Promise<void> => {
  await db.clip.update({
    where: { id: clipId },
    data: { viewCount: { increment: 1 } },
  }).catch((err) => {
    console.warn("[incrementClipView] failed:", err);
  });
};

/**
 * Xóa clip.
 * Permission:
 *   - Streamer (stream.userId) có thể xóa clip của stream mình.
 *   - Creator (creatorId) có thể xóa clip của mình.
 */
export const deleteClip = async (params: {
  clipId: string;
  actingUserId: string;
}): Promise<void> => {
  const { clipId, actingUserId } = params;

  const clip = await db.clip.findUnique({
    where: { id: clipId },
    select: {
      creatorId: true,
      stream: { select: { userId: true } },
    },
  });
  if (!clip) throw new Error("Clip không tồn tại");

  const isCreator = clip.creatorId === actingUserId;
  const isStreamer = clip.stream.userId === actingUserId;

  if (!isCreator && !isStreamer) {
    throw new Error("Bạn không có quyền xóa clip này");
  }

  await db.clip.delete({ where: { id: clipId } });
};

/**
 * Toggle isFeatured — CHỈ STREAMER mới được toggle.
 */
export const toggleClipFeatured = async (params: {
  clipId: string;
  actingUserId: string;
}): Promise<{ isFeatured: boolean }> => {
  const { clipId, actingUserId } = params;

  const clip = await db.clip.findUnique({
    where: { id: clipId },
    select: { isFeatured: true, stream: { select: { userId: true } } },
  });
  if (!clip) throw new Error("Clip không tồn tại");

  if (clip.stream.userId !== actingUserId) {
    throw new Error("Chỉ streamer mới có quyền featured");
  }

  const updated = await db.clip.update({
    where: { id: clipId },
    data: { isFeatured: !clip.isFeatured },
    select: { isFeatured: true },
  });

  return updated;
};
