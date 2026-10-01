import { z } from "zod";
import { IngressInput } from "livekit-server-sdk";

/**
 * Schema validate input cho action createIngress.
 * QUAN TRỌNG: ingressType phải là 1 trong 2 giá trị của IngressInput enum
 * (RTMP_INPUT hoặc WHIP_INPUT) — không dùng parseInt trực tiếp để tránh NaN.
 *
 * Dùng z.nativeEnum(IngressInput) để đảm bảo type-safe và an toàn tuyệt đối,
 * đồng thời giữ nguyên signature là number (vì LiveKit SDK định nghĩa enum là số).
 */
export const CreateIngressSchema = z.object({
  ingressType: z.nativeEnum(IngressInput, {
    message:
      "Loại kết nối không hợp lệ. Chỉ chấp nhận RTMP_INPUT hoặc WHIP_INPUT",
  }),
});

export type CreateIngressInput = z.infer<typeof CreateIngressSchema>;

/**
 * Schema validate input cho action resetIngresses.
 * Input là hostId (UUID) của streamer.
 */
export const ResetIngressesSchema = z.object({
  hostId: z.string().uuid("ID streamer phải là UUID hợp lệ"),
});

export type ResetIngressesInput = z.infer<typeof ResetIngressesSchema>;
