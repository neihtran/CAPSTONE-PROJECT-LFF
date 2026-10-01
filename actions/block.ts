"use server";

import { revalidatePath } from "next/cache";
import { RoomServiceClient } from "livekit-server-sdk";

import { blockUser, unblockUser } from "@/lib/block-service";
import { getSelf } from "@/lib/auth-service";
import { isAppError } from "@/lib/errors";
import { BlockIdSchema } from "./block.schema";

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_API_URL!,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

/**
 * Action: chặn user khỏi room của mình.
 * Đồng thời xóa participant khỏi LiveKit Room nếu đang trong stream.
 * @param id - UUID của user bị chặn.
 */
export const onBlock = async (id: string) => {
  const parsed = BlockIdSchema.safeParse({ id });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "ID không hợp lệ");
  }

  const self = await getSelf();

  let blockedUser;

  try {
    blockedUser = await blockUser(parsed.data.id);
  } catch (error) {
    // User is guest OR typed error
    if (isAppError(error)) {
      throw new Error(error.message);
    }
    // guest case — không throw vẫn tiếp tục remove participant
  }

  try {
    await roomService.removeParticipant(self.id, id);
  } catch {
    // user not in the room — ignore
  }

  revalidatePath(`/u/${self.username}/community`);

  return blockedUser;
};

/**
 * Action: bỏ chặn user.
 * @param id - UUID của user được bỏ chặn.
 */
export const onUnblock = async (id: string) => {
  const parsed = BlockIdSchema.safeParse({ id });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "ID không hợp lệ");
  }

  const self = await getSelf();

  try {
    const unblockedUser = await unblockUser(parsed.data.id);

    revalidatePath(`/u/${self.username}/community`);
    return unblockedUser;
  } catch (error) {
    if (isAppError(error)) {
      throw new Error(error.message);
    }
    throw new Error("Đã xảy ra lỗi, vui lòng thử lại sau");
  }
};
