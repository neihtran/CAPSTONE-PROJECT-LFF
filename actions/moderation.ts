"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSelf } from "@/lib/auth-service";
import {
  addModerator,
  banUser,
  deleteChatMessage,
  isModeratorOrOwner,
  removeModerator,
  timeoutUser,
  unbanUser,
  type ModActionType,
} from "@/lib/moderation-actions-service";
import { enforceRateLimit } from "@/lib/ratelimit";
import { isAppError } from "@/lib/errors";

/**
 * Server actions cho Moderation: timeout / ban / unban / delete-message /
 * add / remove moderator. Tất cả dùng Zod validate + rate limit.
 *
 * Pattern:
 *   1. Zod validate input.
 *   2. enforceRateLimit(userId, { isStrict: true }) — chống spam.
 *   3. getSelf() để lấy actorUserId.
 *   4. Verify actor có quyền (isModeratorOrOwner hoặc isStreamOwner).
 *   5. Gọi service.
 *   6. revalidatePath các trang liên quan.
 *   7. Throw typed Error nếu có vấn đề — UI bắt qua ErrorBoundary.
 */

// ────────────────────────────────────────────────────────────────────────
// Common schemas
// ────────────────────────────────────────────────────────────────────────

const StreamIdSchema = z.object({
  streamId: z.string().uuid(),
});

const TargetUserSchema = z.object({
  streamId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// ────────────────────────────────────────────────────────────────────────
// TIMEOUT
// ────────────────────────────────────────────────────────────────────────

const TimeoutSchema = TargetUserSchema.extend({
  durationMinutes: z
    .number()
    .int()
    .min(1, "Tối thiểu 1 phút")
    .max(10080, "Tối đa 7 ngày (10080 phút)"),
});

/**
 * Action: timeout 1 user khỏi stream.
 * Caller phải là moderator hoặc owner của stream.
 */
export const timeoutUserAction = async (input: z.infer<typeof TimeoutSchema>) => {
  try {
    const parsed = TimeoutSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { streamId, targetUserId, durationMinutes, reason } = parsed.data;

    const self = await getSelf();
    await enforceRateLimit(self.id, { isStrict: true });

    const hasPermission = await isModeratorOrOwner(self.id, streamId);
    if (!hasPermission) {
      throw new Error("Bạn không có quyền mod stream này");
    }

    await timeoutUser({
      streamId,
      targetUserId,
      actorUserId: self.id,
      durationMinutes,
      reason,
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

// ────────────────────────────────────────────────────────────────────────
// BAN
// ────────────────────────────────────────────────────────────────────────

const BanSchema = TargetUserSchema;

/**
 * Action: ban user vĩnh viễn khỏi stream. CHỈ OWNER mới được ban.
 */
export const banUserAction = async (input: z.infer<typeof BanSchema>) => {
  try {
    const parsed = BanSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { streamId, targetUserId, reason } = parsed.data;

    const self = await getSelf();
    await enforceRateLimit(self.id, { isStrict: true });

    await banUser({
      streamId,
      targetUserId,
      actorUserId: self.id,
      reason,
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

// ────────────────────────────────────────────────────────────────────────
// UNBAN
// ────────────────────────────────────────────────────────────────────────

const UnbanSchema = TargetUserSchema;

/**
 * Action: gỡ ban user. CHỈ OWNER mới được unban.
 */
export const unbanUserAction = async (input: z.infer<typeof UnbanSchema>) => {
  try {
    const parsed = UnbanSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { streamId, targetUserId, reason } = parsed.data;

    const self = await getSelf();
    await enforceRateLimit(self.id, { isStrict: true });

    await unbanUser({
      streamId,
      targetUserId,
      actorUserId: self.id,
      reason,
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

// ────────────────────────────────────────────────────────────────────────
// DELETE MESSAGE
// ────────────────────────────────────────────────────────────────────────

const DeleteMessageSchema = z.object({
  streamId: z.string().uuid(),
  messageId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

/**
 * Action: xóa 1 chat message. Moderator hoặc owner.
 */
export const deleteMessageAction = async (
  input: z.infer<typeof DeleteMessageSchema>
) => {
  try {
    const parsed = DeleteMessageSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { streamId, messageId, reason } = parsed.data;

    const self = await getSelf();
    await enforceRateLimit(self.id, { isStrict: true });

    const hasPermission = await isModeratorOrOwner(self.id, streamId);
    if (!hasPermission) {
      throw new Error("Bạn không có quyền mod stream này");
    }

    await deleteChatMessage({
      streamId,
      messageId,
      actorUserId: self.id,
      reason,
    });

    revalidatePath(`/u/${encodeURIComponent(self.username)}/chat`);
    return { success: true };
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new Error(
      error instanceof Error ? error.message : "Lỗi không xác định"
    );
  }
};

// ────────────────────────────────────────────────────────────────────────
// ADD / REMOVE MODERATOR
// ────────────────────────────────────────────────────────────────────────

const AddModSchema = z.object({
  streamId: z.string().uuid(),
  userId: z.string().uuid(),
});

/**
 * Action: add user làm moderator. CHỈ OWNER.
 */
export const addModeratorAction = async (
  input: z.infer<typeof AddModSchema>
) => {
  try {
    const parsed = AddModSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { streamId, userId } = parsed.data;

    const self = await getSelf();
    await enforceRateLimit(self.id, { isStrict: true });

    await addModerator({
      streamId,
      userId,
      ownerUserId: self.id,
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

/**
 * Action: remove moderator. CHỈ OWNER.
 */
export const removeModeratorAction = async (
  input: z.infer<typeof AddModSchema>
) => {
  try {
    const parsed = AddModSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { streamId, userId } = parsed.data;

    const self = await getSelf();
    await enforceRateLimit(self.id, { isStrict: true });

    await removeModerator({
      streamId,
      userId,
      ownerUserId: self.id,
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

// ────────────────────────────────────────────────────────────────────────
// EXPORT TYPE for client typing
// ────────────────────────────────────────────────────────────────────────

export type ModActionTypeExport = ModActionType;
