import { z } from "zod";

/**
 * Schema validate input cho action updateUser.
 * Hiện tại chỉ cho phép cập nhật bio, giới hạn 500 ký tự.
 */
export const UpdateUserSchema = z.object({
  bio: z
    .string()
    .max(500, "Tiểu sử tối đa 500 ký tự")
    .nullable()
    .optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
