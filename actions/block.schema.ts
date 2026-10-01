import { z } from "zod";

/**
 * Schema validate input cho action onBlock và onUnblock.
 * Input là id (UUID) của user bị chặn/bỏ chặn.
 */
export const BlockIdSchema = z.object({
  id: z.string().uuid("ID người dùng phải là UUID hợp lệ"),
});

export type BlockIdInput = z.infer<typeof BlockIdSchema>;
