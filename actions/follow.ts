"use server";

import { revalidatePath } from "next/cache";

import { followUser, unfollowUser } from "@/lib/follow-service";
import { isAppError } from "@/lib/errors";
import { FollowIdSchema } from "./follow.schema";

/**
 * Action: follow user.
 * @param id - UUID của user muốn theo dõi.
 *
 * Surface typed error messages từ service (vd: "Bạn đã theo dõi rồi") thay vì
 * throw "Internal server error" chung chung → UI hiển thị đúng lý do cho user.
 */
export const onFollow = async (id: string) => {
  const parsed = FollowIdSchema.safeParse({ id });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "ID không hợp lệ");
  }

  try {
    const followedUser = await followUser(parsed.data.id);

    revalidatePath("/");

    if (followedUser) {
      revalidatePath(`/${followedUser.following.username}`);
    }

    return followedUser;
  } catch (error) {
    if (isAppError(error)) {
      throw new Error(error.message);
    }
    throw new Error("Đã xảy ra lỗi, vui lòng thử lại sau");
  }
};

/**
 * Action: bỏ theo dõi user.
 * @param id - UUID của user muốn bỏ theo dõi.
 */
export const onUnfollow = async (id: string) => {
  const parsed = FollowIdSchema.safeParse({ id });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "ID không hợp lệ");
  }

  try {
    const unfollowedUser = await unfollowUser(parsed.data.id);

    revalidatePath("/");

    if (unfollowedUser) {
      revalidatePath(`/${unfollowedUser.following.username}`);
    }

    return unfollowedUser;
  } catch (error) {
    if (isAppError(error)) {
      throw new Error(error.message);
    }
    throw new Error("Đã xảy ra lỗi, vui lòng thử lại sau");
  }
};
