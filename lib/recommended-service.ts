import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";

/**
 * Recommended streamers cho sidebar — chưa follow, không bị block, không phải self.
 */
export const getRecommended = async () => {
  let userId: string | null = null;

  try {
    const self = await getSelf();
    userId = self.id;
  } catch {
    userId = null;
  }

  if (userId) {
    return db.user.findMany({
      where: {
        AND: [
          {
            NOT: {
              id: userId,
            },
          },
          {
            NOT: {
              followedBy: {
                some: {
                  followerId: userId,
                },
              },
            },
          },
          {
            NOT: {
              blocking: {
                some: {
                  blockedId: userId,
                },
              },
            },
          },
        ],
      },
      include: {
        stream: {
          select: {
            isLive: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  return db.user.findMany({
    include: {
      stream: {
        select: {
          isLive: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};
