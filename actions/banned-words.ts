"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSelf } from "@/lib/auth-service";
import { db } from "@/lib/db";
import {
  BannedWordAction,
  isStreamOwner,
} from "@/lib/moderation-actions-service";
import { enforceRateLimit } from "@/lib/ratelimit";
import { isAppError } from "@/lib/errors";

/**
 * Server actions cho Banned Words (AutoMod).
 *
 * Owner quản lý danh sách regex / string banned.
 * Khi chat message được gửi (qua /api/chat), check pattern trước khi broadcast.
 */

const CreateBannedWordSchema = z.object({
  streamId: z.string().uuid(),
  pattern: z
    .string()
    .min(1)
    .max(500, "Pattern tối đa 500 ký tự")
    .refine(
      // Reject newline/control chars to keep patterns safe.
      (v) => !/[\x00-\x1f]/.test(v),
      "Pattern không được chứa ký tự điều khiển"
    ),
  action: z.enum([
    BannedWordAction.REJECT,
    BannedWordAction.FILTER,
  ]),
  reason: z.string().max(200).optional(),
});

/**
 * Action: thêm banned word cho stream. CHỈ OWNER.
 */
export const addBannedWordAction = async (
  input: z.infer<typeof CreateBannedWordSchema>
) => {
  try {
    const parsed = CreateBannedWordSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { streamId, pattern, action, reason } = parsed.data;

    const self = await getSelf();
    await enforceRateLimit(self.id, { isStrict: true });

    const isOwner = await isStreamOwner(self.id, streamId);
    if (!isOwner) {
      throw new Error("Chỉ chủ stream mới có quyền thêm banned word");
    }

    // Check pattern có hợp lệ regex không (nếu user có chủ ý dùng regex).
    // Không bắt buộc — có thể là plain text → escape khi match.
    // Ở đây chỉ warn, không block.
    if (pattern.includes("\\") || pattern.includes("[") || /\W{2,}/.test(pattern)) {
      try {
        new RegExp(pattern, "i");
      } catch {
        throw new Error("Pattern regex không hợp lệ");
      }
    }

    await db.bannedWord.create({
      data: { streamId, pattern, action, reason },
    });

    revalidatePath(`/u/${encodeURIComponent(self.username)}/community`);
    return { success: true };
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new Error(
      error instanceof Error ? error.message : "Lỗi không xác định"
    );
  }
};

const DeleteBannedWordSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Action: xóa banned word. CHỈ OWNER.
 *
 * Verify ownership qua streamId sau khi tìm banned word.
 */
export const removeBannedWordAction = async (
  input: z.infer<typeof DeleteBannedWordSchema>
) => {
  try {
    const parsed = DeleteBannedWordSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { id } = parsed.data;

    const self = await getSelf();

    const bannedWord = await db.bannedWord.findUnique({
      where: { id },
      select: { streamId: true },
    });
    if (!bannedWord) throw new Error("Banned word không tồn tại");

    const isOwner = await isStreamOwner(self.id, bannedWord.streamId);
    if (!isOwner) {
      throw new Error("Chỉ chủ stream mới có quyền xóa banned word");
    }

    await db.bannedWord.delete({ where: { id } });

    revalidatePath(`/u/${encodeURIComponent(self.username)}/community`);
    return { success: true };
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new Error(
      error instanceof Error ? error.message : "Lỗi không xác định"
    );
  }
};
