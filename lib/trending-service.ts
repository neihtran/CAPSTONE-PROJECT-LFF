import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";

/**
 * TrendingService — tính toán streams đang "trending" / hot.
 *
 * Algorithm hiện tại (đơn giản, MVP):
 *   Trending score = (isLive ? 100 : 0) + (chatMessageCount 24h gần nhất × 1)
 *
 * Lý do:
 *   - isLive > offline → boost lớn.
 *   - Số chat messages trong 24h → proxy cho engagement.
 *
 * Sprint sau có thể thay bằng:
 *   - View count qua LiveKit presence.
 *   - Follow velocity (follows/hour).
 *   - Time-decay: streams live lâu → score giảm theo giờ.
 */

export type TrendingStream = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  isLive: boolean;
  user: {
    id: string;
    username: string;
    imageUrl: string;
    bio: string | null;
  };
  score: number;
};

/**
 * Lấy top N trending streams.
 *
 * @param options.viewerId - exclude users bị block mutual.
 * @param options.limit - max streams trả về (default 12).
 */
export const getTrendingStreams = async (
  options: {
    viewerId?: string | null;
    limit?: number;
  } = {}
): Promise<TrendingStream[]> => {
  const { viewerId = null, limit = 12 } = options;

  // Bước 1: Lấy live streams + offline gần đây (limit 100 cho trending pool).
  const candidateStreams = await db.stream.findMany({
    where: {
      // Chỉ xét streams active trong 24h gần nhất.
      updatedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      ...(viewerId
        ? {
            // Exclude self.
            userId: { not: viewerId },
            // Exclude block mutual.
            user: {
              NOT: {
                blocking: {
                  some: {
                    blockedId: viewerId,
                  },
                },
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      thumbnailUrl: true,
      isLive: true,
      user: {
        select: {
          id: true,
          username: true,
          imageUrl: true,
          bio: true,
        },
      },
    },
    take: 100,
  });

  if (candidateStreams.length === 0) {
    return [];
  }

  // Bước 2: Đếm chat messages trong 24h cho mỗi stream (parallel query).
  const streamIds = candidateStreams.map((s) => s.id);
  const counts = await db.chatMessage.groupBy({
    by: ["streamId"],
    where: {
      streamId: { in: streamIds },
      sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    _count: { _all: true },
  });
  const countByStreamId = new Map<string, number>(
    counts.map((c) => [c.streamId, c._count._all])
  );

  // Bước 3: Tính score.
  const scored = candidateStreams.map((stream) => {
    const chatCount = countByStreamId.get(stream.id) ?? 0;
    const liveBoost = stream.isLive ? 100 : 0;
    return {
      ...stream,
      score: liveBoost + chatCount,
    };
  });

  // Sort giảm dần theo score.
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
};

/**
 * Wrapper gọi getTrendingStreams với viewerId từ session.
 */
export const getTrending = async (limit = 12): Promise<TrendingStream[]> => {
  let viewerId: string | null = null;
  try {
    const self = await getSelf();
    viewerId = self.id;
  } catch {
    viewerId = null;
  }

  return getTrendingStreams({ viewerId, limit });
};
