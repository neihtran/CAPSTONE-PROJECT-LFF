import { currentUser } from "@clerk/nextjs/server";

import { db } from "@/lib/db";
import {
  UnauthorizedError,
  UserNotFoundError,
} from "@/lib/errors";

/**
 * Lấy thông tin user hiện tại từ Clerk session.
 *
 * Throw `UnauthorizedError` nếu chưa đăng nhập.
 * Throw `UserNotFoundError` nếu user không tồn tại trong DB (có thể xảy ra
 * khi Clerk webhook chưa sync xong).
 */
export const getSelf = async () => {
  const self = await currentUser();

  if (!self || !self.username) {
    throw new UnauthorizedError();
  }

  const user = await db.user.findUnique({
    where: {
      externalUserId: self.id,
    },
  });

  if (!user) {
    throw new UserNotFoundError();
  }

  return user;
};

/**
 * Lấy user hiện tại theo username — yêu cầu username trùng với user đăng nhập.
 *
 * Dùng cho dashboard `/u/[username]/*` — chỉ cho phép owner truy cập.
 *
 * Throw `UnauthorizedError` nếu không phải owner.
 */
export const getSelfByUsername = async (username: string) => {
  const self = await currentUser();

  if (!self || !self.username) {
    throw new UnauthorizedError();
  }

  const user = await db.user.findUnique({
    where: {
      username,
    },
    include: { stream: true },
  });

  if (!user) {
    throw new UserNotFoundError("Không tìm thấy user với username này");
  }

  if (self.username !== username) {
    throw new UnauthorizedError("Bạn không có quyền truy cập trang này");
  }

  return user;
};
