import { z } from "zod";

/**
 * Schema validate input cho action onFollow và onUnfollow.
 * Input là id (UUID) của user muốn follow/unfollow.
 */
export const FollowIdSchema = z.object({
  id: z.string().uuid("ID người dùng phải là UUID hợp lệ"),
});

export type FollowIdInput = z.infer<typeof FollowIdSchema>;
