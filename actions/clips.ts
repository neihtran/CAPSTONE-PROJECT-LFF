"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSelf } from "@/lib/auth-service";
import {
  createClip,
  deleteClip,
  toggleClipFeatured,
} from "@/lib/clip-service";
import { enforceRateLimit } from "@/lib/ratelimit";
import { isAppError } from "@/lib/errors";

/**
 * Server actions cho Clips.
 *
 * CreateClipSchema: validate title, videoUrl, startTime, endTime.
 * Permission:
 *   - createClip: bất kỳ viewer nào cũng tạo được.
 *   - deleteClip: streamer hoặc creator.
 *   - toggleFeatured: chỉ streamer.
 */

const CreateClipSchema = z.object({
  streamId: z.string().uuid(),
  title: z.string().min(1).max(200),
  videoUrl: z.string().url("videoUrl phải là URL hợp lệ"),
  thumbnail: z.string().url().optional().nullable(),
  startTime: z.number().int().min(0).default(0),
  endTime: z.number().int().min(1).default(60),
});

/**
 * Action: tạo clip mới.
 */
export const createClipAction = async (
  input: z.infer<typeof CreateClipSchema>
) => {
  try {
    const parsed = CreateClipSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { streamId, title, videoUrl, thumbnail, startTime, endTime } =
      parsed.data;

    const self = await getSelf();
    // Rate limit: max 10 clip / 1 phút / user.
    await enforceRateLimit(`clip:${self.id}`, { isStrict: true });

    const clip = await createClip({
      streamId,
      creatorId: self.id,
      title,
      videoUrl,
      thumbnail,
      startTime,
      endTime,
    });

    // Revalidate stream page nếu user là streamer (cho trang clips của mình).
    revalidatePath(`/clips`);
    revalidatePath(`/u/${encodeURIComponent(self.username)}`);

    return { success: true, clipId: clip.id };
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new Error(
      error instanceof Error ? error.message : "Lỗi không xác định"
    );
  }
};

const DeleteClipSchema = z.object({
  clipId: z.string().uuid(),
});

/**
 * Action: xóa clip (streamer hoặc creator).
 */
export const deleteClipAction = async (
  input: z.infer<typeof DeleteClipSchema>
) => {
  try {
    const parsed = DeleteClipSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const self = await getSelf();
    await deleteClip({ clipId: parsed.data.clipId, actingUserId: self.id });

    revalidatePath(`/clips`);
    revalidatePath(`/u/${encodeURIComponent(self.username)}`);

    return { success: true };
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new Error(
      error instanceof Error ? error.message : "Lỗi không xác định"
    );
  }
};

const ToggleFeaturedSchema = z.object({
  clipId: z.string().uuid(),
});

/**
 * Action: toggle featured (chỉ streamer).
 */
export const toggleClipFeaturedAction = async (
  input: z.infer<typeof ToggleFeaturedSchema>
) => {
  try {
    const parsed = ToggleFeaturedSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const self = await getSelf();
    const result = await toggleClipFeatured({
      clipId: parsed.data.clipId,
      actingUserId: self.id,
    });

    revalidatePath(`/u/${encodeURIComponent(self.username)}`);

    return { success: true, isFeatured: result.isFeatured };
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new Error(
      error instanceof Error ? error.message : "Lỗi không xác định"
    );
  }
};
