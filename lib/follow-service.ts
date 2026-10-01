import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";
import { enforceRateLimit } from "@/lib/ratelimit";
import {
  AlreadyFollowingError,
  CannotInteractError,
  NotFollowingError,
  SelfActionError,
  UserNotFoundError,
} from "@/lib/errors";

export const getFollwedUser = async () => {
  try {
    const self = await getSelf();

    const followedUsers = await db.follow.findMany({
      where: {
        followerId: self.id,
        following: {
          blocking: {
            none: {
              blockedId: self.id,
            },
          },
        },
      },
      include: {
        following: {
          include: {
            stream: {
              select: {
                isLive: true,
              },
            },
          },
        },
      },
    });

    return followedUsers;
  } catch (error) {
    return [];
  }
};

export const isFollowingUser = async (id: string) => {
  try {
    const self = await getSelf();

    const otherUser = await db.user.findUnique({
      where: { id },
    });

    if (!otherUser) throw new UserNotFoundError();

    if (otherUser.id === self.id) return true;

    const existingFollow = await db.follow.findFirst({
      where: {
        followerId: self.id,
        followingId: otherUser.id,
      },
    });

    return !!existingFollow;
  } catch {
    return false;
  }
};

/**
 * Follow một user.
 *
 * Edge cases đã handle:
 *   - Self follow → throw `SelfActionError`
 *   - Mutual block (mình chặn người ta HOẶC người ta chặn mình) → throw `CannotInteractError`
 *   - Đã follow rồi → throw `AlreadyFollowingError`
 *   - Rate limit per-user (10 req / 10s)
 */
export const followUser = async (id: string) => {
  const self = await getSelf();

  // Rate limit theo userId — chống spam follow.
  await enforceRateLimit(`follow:${self.id}`);

  const otherUser = await db.user.findUnique({
    where: { id },
  });

  if (!otherUser) throw new UserNotFoundError();

  if (otherUser.id === self.id) throw new SelfActionError("Bạn không thể tự theo dõi chính mình");

  // ── Check mutual block: nếu 1 trong 2 đã chặn → không cho follow ──
  const mutualBlock = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: self.id, blockedId: otherUser.id },
        { blockerId: otherUser.id, blockedId: self.id },
      ],
    },
  });

  if (mutualBlock) {
    throw new CannotInteractError(
      "Không thể theo dõi vì một trong hai đã chặn người kia"
    );
  }

  const existingFollow = await db.follow.findFirst({
    where: {
      followerId: self.id,
      followingId: otherUser.id,
    },
  });

  if (existingFollow) throw new AlreadyFollowingError();

  const follow = await db.follow.create({
    data: {
      followerId: self.id,
      followingId: otherUser.id,
    },
    include: {
      follower: true,
      following: true,
    },
  });

  // Trigger notification + alert cho người được follow (không block luồng chính).
  Promise.all([
    (async () => {
      try {
        const { notifyFollow } = await import("@/lib/notification-service");
        await notifyFollow({
          followerId: self.id,
          followedId: otherUser.id,
          followerUsername: self.username,
        });
      } catch (err) {
        console.warn("[followUser] notification failed:", err);
      }
    })(),
    (async () => {
      try {
        const { buildAlert } = await import("@/lib/alert-service");
        await buildAlert({
          streamerId: otherUser.id,
          type: "FOLLOW",
          username: self.username,
        });
      } catch (err) {
        console.warn("[followUser] alert trigger failed:", err);
      }
    })(),
  ]);

  return follow;
};

/**
 * Unfollow một user.
 *
 * Edge cases đã handle:
 *   - Self unfollow → throw `SelfActionError`
 *   - Chưa follow → throw `NotFollowingError` (trong errors.ts)
 *   - Rate limit per-user
 */
export const unfollowUser = async (id: string) => {
  const self = await getSelf();

  await enforceRateLimit(`follow:${self.id}`);

  const otherUser = await db.user.findUnique({
    where: { id },
  });

  if (!otherUser) throw new UserNotFoundError();

  if (otherUser.id === self.id) throw new SelfActionError("Bạn không thể bỏ theo dõi chính mình");

  const existingFollow = await db.follow.findFirst({
    where: {
      followerId: self.id,
      followingId: otherUser.id,
    },
  });

  if (!existingFollow) throw new NotFollowingError();

  const follow = await db.follow.delete({
    where: {
      id: existingFollow.id,
    },
    include: {
      following: true,
    },
  });

  return follow;
};
