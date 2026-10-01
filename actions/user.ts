"use server";

import { User } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getSelf } from "@/lib/auth-service";
import { db } from "@/lib/db";
import { UpdateUserSchema } from "./user.schema";

/**
 * Action: cập nhật thông tin User của người dùng hiện tại.
 * Chỉ cho phép cập nhật bio (whitelist), không nhận trực tiếp Partial<User>
 * để tránh ghi đè các field nhạy cảm (id, username, externalUserId, ...).
 * @param values - Partial<User> nhưng sẽ được validate qua UpdateUserSchema.
 */
export const updateUser = async (values: Partial<User>) => {
  // 1) Validate input — chặn query DB nếu input sai hoặc chứa field không hợp lệ.
  const parsed = UpdateUserSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Dữ liệu người dùng không hợp lệ"
    );
  }

  const self = await getSelf();

  // 2) Chỉ lấy các field đã validate, tránh mass-assignment.
  const validData = {
    bio: parsed.data.bio,
  };

  const user = await db.user.update({
    where: { id: self.id },
    data: validData,
  });

  revalidatePath(`/${self.username}`);
  revalidatePath(`/u/${self.username}`);

  return user;
};
