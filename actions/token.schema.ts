import { z } from "zod";

/**
 * Schema validate input cho action createViewerToken.
 * Input là hostIdentity (UUID) của streamer mà viewer muốn tham gia.
 */
export const CreateViewerTokenSchema = z.object({
  hostIdentity: z
    .string()
    .uuid("ID streamer phải là UUID hợp lệ"),
});

export type CreateViewerTokenInput = z.infer<typeof CreateViewerTokenSchema>;
