"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";
import { setStreamCategories } from "@/lib/category-service";
import { setStreamTags } from "@/lib/tag-service";
import { enforceRateLimit } from "@/lib/ratelimit";
import { isAppError } from "@/lib/errors";

/**
 * Schema validate input update categories cho stream của current user.
 *
 * Owner update = chỉ được edit stream của chính mình (check qua userId match).
 */
const UpdateStreamCategoriesSchema = z.object({
  categoryIds: z
    .array(z.string().uuid())
    .min(0)
    .max(5, "Tối đa 5 categories cho 1 stream"),
});

/**
 * Action: update categories của stream hiện tại (owner only).
 *
 * Flow:
 *   1. Validate input (0-5 category IDs).
 *   2. Rate limit per user.
 *   3. Verify ownership (stream.userId === self.id).
 *   4. setStreamCategories → atomic transaction xóa cũ + tạo mới.
 *   5. revalidatePath các trang public/private liên quan.
 */
export const updateStreamCategories = async (
  categoryIds: string[]
): Promise<void> => {
  try {
    const parsed = UpdateStreamCategoriesSchema.safeParse({ categoryIds });
    if (!parsed.success) {
      throw new Error(
        parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ"
      );
    }

    const self = await getSelf();

    await enforceRateLimit(`categories:update:${self.id}`);

    const selfStream = await db.stream.findUnique({
      where: { userId: self.id },
      select: { id: true },
    });

    if (!selfStream) {
      throw new Error("Bạn chưa có stream");
    }

    // Verify tất cả categoryIds tồn tại.
    const existing = await db.category.findMany({
      where: { id: { in: parsed.data.categoryIds } },
      select: { id: true },
    });

    if (existing.length !== parsed.data.categoryIds.length) {
      throw new Error("Một số category không tồn tại");
    }

    await setStreamCategories(selfStream.id, parsed.data.categoryIds);

    revalidatePath(`/u/${self.username}`);
    revalidatePath(`/${self.username}`);
    revalidatePath("/");
    revalidatePath(`/browse/[slug]`); // Wildcard — Next.js sẽ revalidate tất cả matches
  } catch (error) {
    if (isAppError(error)) throw new Error(error.message);
    throw new Error("Đã xảy ra lỗi, vui lòng thử lại sau");
  }
};

/**
 * Schema validate input update tags cho stream.
 */
const UpdateStreamTagsSchema = z.object({
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(20, "Tối đa 20 tags"),
});

/**
 * Action: update tags của stream hiện tại (owner only).
 *
 * Tags là user-created — nếu tag chưa tồn tại sẽ tự upsert.
 */
export const updateStreamTags = async (tags: string[]): Promise<void> => {
  try {
    const parsed = UpdateStreamTagsSchema.safeParse({ tags });
    if (!parsed.success) {
      throw new Error(
        parsed.error.issues[0]?.message ?? "Dữ liệu tags không hợp lệ"
      );
    }

    const self = await getSelf();

    await enforceRateLimit(`tags:update:${self.id}`);

    const selfStream = await db.stream.findUnique({
      where: { userId: self.id },
      select: { id: true },
    });

    if (!selfStream) {
      throw new Error("Bạn chưa có stream");
    }

    await setStreamTags(selfStream.id, parsed.data.tags);

    revalidatePath(`/u/${self.username}`);
    revalidatePath(`/${self.username}`);
  } catch (error) {
    if (isAppError(error)) throw new Error(error.message);
    throw new Error("Đã xảy ra lỗi, vui lòng thử lại sau");
  }
};
