import { z } from "zod";

/**
 * Schema validate input cho action updateStream.
 * Chỉ chấp nhận các field hợp lệ của Stream, với validation chặt:
 * - name: 1-100 ký tự
 * - thumbnailUrl: URL hợp lệ hoặc null
 * - 3 flag boolean cho chat
 */
export const UpdateStreamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên stream không được để trống")
    .max(100, "Tên stream tối đa 100 ký tự")
    .optional(),
  thumbnailUrl: z
    .string()
    .url("Thumbnail phải là URL hợp lệ")
    .nullable()
    .optional(),
  isChatEnabled: z.boolean().optional(),
  isChatDelayed: z.boolean().optional(),
  isChatFollowersOnly: z.boolean().optional(),
});

/**
 * Schema validate input cho endStream.
 * Chỉ chấp nhận streamId UUID hợp lệ.
 */
export const EndStreamSchema = z.object({
  streamId: z.string().uuid("Stream ID phải là UUID hợp lệ"),
});

export type UpdateStreamInput = z.infer<typeof UpdateStreamSchema>;
export type EndStreamInput = z.infer<typeof EndStreamSchema>;
