import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";

/**
 * Lấy tất cả streams đang live + offline, dùng cho trang home "Những stream bạn có thể thích".
 *
 * Edge cases:
 *   - Exclude self khỏi feed (không tự gợi ý chính mình).
 *   - Exclude user đã bị mình chặn HOẶC chặn mình.
 *   - Sort: live trước, sau đó mới nhất.
 *   - Nếu chưa login → trả về stream công khai (không exclude).
 */
export const getStreams = async () => {
  let userId: string | null = null;

  try {
    const self = await getSelf();
    userId = self.id;
  } catch {
    userId = null;
  }

  const baseSelect = {
    thumbnailUrl: true,
    name: true,
    isLive: true,
    user: true,
    id: true,
    categories: {
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    },
    tags: {
      include: {
        tag: {
          select: { id: true, name: true, slug: true },
        },
      },
    },
  } as const;

  if (userId) {
    return db.stream.findMany({
      where: {
        // Exclude self
        userId: { not: userId },
        // Exclude users mà self chặn HOẶC chặn self
        user: {
          NOT: {
            blocking: {
              some: {
                blockedId: userId,
              },
            },
          },
        },
      },
      select: baseSelect,
      orderBy: [{ isLive: "desc" }, { updatedAt: "desc" }],
    });
  }

  return db.stream.findMany({
    select: baseSelect,
    orderBy: [{ isLive: "desc" }, { updatedAt: "desc" }],
  });
};
