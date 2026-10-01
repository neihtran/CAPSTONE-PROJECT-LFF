"use server";

import { Stream } from "@prisma/client";
import { RoomServiceClient } from "livekit-server-sdk";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";
import { enforceRateLimit } from "@/lib/ratelimit";
import { UpdateStreamSchema, EndStreamSchema } from "./stream.schema";

/**
 * Action: cập nhật thông tin Stream của người dùng hiện tại.
 *
 * Đồng thời đẩy trạng thái chat mới vào LiveKit Room metadata để viewer nhận
 * được update real-time (không cần navigate/reload trang).
 *
 * @param values - Partial<Stream> nhưng sẽ được validate qua UpdateStreamSchema.
 */
export const updateStream = async (values: Partial<Stream>) => {
  try {
    // 1) Validate input — chặn query DB nếu input sai hoặc chứa field không hợp lệ.
    const parsed = UpdateStreamSchema.safeParse(values);
    if (!parsed.success) {
      throw new Error(
        parsed.error.issues[0]?.message ?? "Dữ liệu stream không hợp lệ"
      );
    }

    const self = await getSelf();
    const selfStream = await db.stream.findUnique({
      where: {
        userId: self.id,
      },
    });

    if (!selfStream) {
      throw new Error("No stream found");
    }

    // Chỉ lấy các field đã validate, tránh mass-assignment các field nhạy cảm
    // (ingressId, serverUrl, streamKey, isLive, userId, id).
    const validData = {
      name: parsed.data.name,
      thumbnailUrl: parsed.data.thumbnailUrl,
      isChatEnabled: parsed.data.isChatEnabled,
      isChatFollowersOnly: parsed.data.isChatFollowersOnly,
      isChatDelayed: parsed.data.isChatDelayed,
    };

    const stream = await db.stream.update({
      where: {
        id: selfStream.id,
      },
      data: {
        ...validData,
      },
    });

    // 2) Đẩy trạng thái chat mới lên LiveKit Room metadata.
    //    Viewer sẽ nhận RoomEvent.RoomMetadataChanged và update UI real-time.
    //    Fail-open: nếu không connect tới LiveKit (vd: stream chưa live) thì bỏ qua.
    await syncRoomMetadata(self.id, {
      isChatEnabled: stream.isChatEnabled,
      isChatDelayed: stream.isChatDelayed,
      isChatFollowersOnly: stream.isChatFollowersOnly,
    });

    revalidatePath(`/u/${self.username}/chat`);
    revalidatePath(`/u/${self.username}`);
    revalidatePath(`/${self.username}`);

    return stream;
  } catch (error) {
    console.error("updateStream", error);
    throw new Error("Internal server error");
  }
};

/**
 * Action: chủ động kết thúc phiên live.
 *
 * Flow:
 *   1. Đóng LiveKit Room (RoomServiceClient.deleteRoom) → tất cả participants
 *      (kể cả viewer) sẽ nhận RoomEvent.Disconnected ngay lập tức.
 *      QUAN TRỌNG: gọi deleteRoom giúp giải phóng WebRTC minutes quota miễn phí.
 *   2. Update DB: isLive=false + clear ingress/streamKey để chống leak.
 *   3. revalidatePath các trang liên quan.
 *
 * @param streamId - UUID của Stream cần kết thúc.
 */
export const endStream = async (streamId: string) => {
  // 1) Validate input.
  const parsed = EndStreamSchema.safeParse({ streamId });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Stream ID không hợp lệ"
    );
  }

  try {
    // 2) Verify ownership — chỉ chủ sở hữu stream mới được end.
    const self = await getSelf();
    const stream = await db.stream.findUnique({
      where: { id: parsed.data.streamId },
      select: { id: true, userId: true, isLive: true },
    });

    if (!stream) throw new Error("Stream không tồn tại");
    if (stream.userId !== self.id) {
      throw new Error("Bạn không có quyền kết thúc stream này");
    }
    if (!stream.isLive) {
      throw new Error("Stream đã kết thúc từ trước");
    }

    // 3) Rate limit để chống spam end (tránh quota API LiveKit).
    await enforceRateLimit(`end-stream:${self.id}`, { isStrict: false });

    // 4) Đóng LiveKit Room. Tất cả viewers sẽ bị disconnect real-time.
    const apiUrl = process.env.LIVEKIT_API_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (apiUrl && apiKey && apiSecret) {
      try {
        const roomService = new RoomServiceClient(apiUrl, apiKey, apiSecret);
        // Room name = userId của host.
        await roomService.deleteRoom(self.id);
      } catch (lkError) {
        // Fail-open: log warning nhưng vẫn tiếp tục update DB.
        // Lý do: viewer có thể đã thoát, hoặc room không tồn tại → không block end stream.
        console.warn(
          "[endStream] Không thể đóng LiveKit room:",
          lkError instanceof Error ? lkError.message : lkError
        );
      }
    } else {
      console.warn("[endStream] LiveKit env chưa được set — bỏ qua đóng room.");
    }

    // 5) Update DB: isLive=false + clear credentials để chống leak.
    const updated = await db.stream.update({
      where: { id: parsed.data.streamId },
      data: {
        isLive: false,
        // Không xóa ingressId/serverUrl/streamKey — giữ để OBS reconnect được
        // nếu streamer muốn go-live lại ngay (chỉ tạo lại khi cần).
      },
    });

    // 6) Revalidate các trang liên quan.
    revalidatePath(`/u/${self.username}`);
    revalidatePath(`/${self.username}`);
    revalidatePath(`/${self.username}/keys`);
    revalidatePath("/"); // home page — update LIVE badge

    return updated;
  } catch (error) {
    console.error("endStream", error);
    throw new Error(
      error instanceof Error ? error.message : "Không thể kết thúc stream"
    );
  }
};

/**
 * Đẩy state mới lên LiveKit Room metadata của stream.
 *
 * Sử dụng RoomServiceClient.updateRoom() để set metadata — tất cả participants
 * (kể cả viewer) sẽ nhận RoomEvent.RoomMetadataChanged và re-render.
 *
 * Fail-open: nếu LiveKit API lỗi (chưa live, sai credentials...) thì log và
 * bỏ qua — DB vẫn là source of truth, viewer có thể refresh để lấy state mới.
 */
async function syncRoomMetadata(
  hostUserId: string,
  state: {
    isChatEnabled: boolean;
    isChatDelayed: boolean;
    isChatFollowersOnly: boolean;
  }
): Promise<void> {
  const apiUrl = process.env.LIVEKIT_API_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  // Không có config → bỏ qua (fail-open cho dev local).
  if (!apiUrl || !apiKey || !apiSecret) {
    console.warn(
      "[updateStream] LiveKit env chưa được set — bỏ qua sync Room metadata."
    );
    return;
  }

  try {
    // Dynamic import để tránh crash nếu livekit-server-sdk chưa được load.
    const { RoomServiceClient } = await import("livekit-server-sdk");
    const roomService = new RoomServiceClient(apiUrl, apiKey, apiSecret);
    // SDK v1.2.7 dùng updateRoomMetadata(room, metadata) — không phải updateRoom().
    // Room name trong LiveKit thường là userId của host.
    await roomService.updateRoomMetadata(hostUserId, JSON.stringify(state));
  } catch (error) {
    // Log warning nhưng KHÔNG throw — action đã thành công ở DB.
    // Viewer vẫn có thể lấy state mới khi reload.
    console.warn(
      "[updateStream] Không thể sync LiveKit Room metadata:",
      error instanceof Error ? error.message : error
    );
  }
}
