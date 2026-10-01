import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";
import { enforceRateLimit } from "@/lib/ratelimit";
import {
  AlreadyBlockedError,
  NotBlockedError,
  SelfActionError,
  UserNotFoundError,
} from "@/lib/errors";

export const isBlockedByUser = async (id: string) => {
  try {
    const self = await getSelf();

    const otherUser = await db.user.findUnique({
      where: { id },
    });

    if (!otherUser) throw new Error("User not found");

    if (otherUser.id === self.id) return false;

    const existingBlock = await db.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: otherUser.id,
          blockedId: self.id,
        },
      },
    });

    return !!existingBlock;
  } catch {
    return false;
  }
};

export const blockUser = async (id: string) => {
  const self = await getSelf();

  // Rate limit theo userId — chống spam block.
  await enforceRateLimit(`block:${self.id}`);

  if (self.id === id) throw new SelfActionError("Không thể tự chặn chính mình");

  const otherUser = await db.user.findUnique({
    where: { id },
  });

  if (!otherUser) throw new UserNotFoundError();

  const existingBlock = await db.block.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: self.id,
        blockedId: otherUser.id,
      },
    },
  });

  if (existingBlock) throw new AlreadyBlockedError();

  const block = await db.block.create({
    data: {
      blockerId: self.id,
      blockedId: otherUser.id,
    },
    include: {
      blocked: true,
    },
  });

  return block;
};

export const unblockUser = async (id: string) => {
  const self = await getSelf();

  // Rate limit dùng chung key với block.
  await enforceRateLimit(`block:${self.id}`);

  if (self.id === id) throw new SelfActionError("Không thể bỏ chặn chính mình");

  const otherUser = await db.user.findUnique({
    where: { id },
  });

  if (!otherUser) throw new UserNotFoundError();

  const existingBlock = await db.block.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: self.id,
        blockedId: otherUser.id,
      },
    },
  });

  if (!existingBlock) throw new NotBlockedError();

  const unblock = await db.block.delete({
    where: {
      id: existingBlock.id,
    },
    include: {
      blocked: true,
    },
  });

  return unblock;
};

export const getBlockedUsers = async () => {
  const self = await getSelf();

  const blockedUsers = await db.block.findMany({
    where: {
      blockerId: self.id,
    },
    include: {
      blocked: true,
    },
  });

  return blockedUsers;
};
