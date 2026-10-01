/**
 * AlertService — quản lý stream alerts (popup animations).
 *
 * Alert types:
 *   - FOLLOW: viewer follow streamer.
 *   - SUBSCRIBE: viewer subscribe streamer.
 *   - DONATION: viewer donate tip.
 *   - RAID: viewer raid channel (TBD).
 *   - CLIP: clip created from stream.
 *
 * Alert lifecycle:
 *   1. Trigger event (subscribe/donate/follow).
 *   2. Server gửi alert qua LiveKit data channel → tất cả viewers trong room nhận.
 *   3. AlertToast component hiển thị popup animation.
 *   4. AlertQueue stack nhiều alerts (max 3 visible cùng lúc).
 *
 * Alert delivery:
 *   - Real-time: qua LiveKit Room → dataChannel (InstantGame/Chat message).
 *   - Fallback: polling / SSE nếu viewer không trong room.
 */

import { db } from "@/lib/db";

export type AlertType = "FOLLOW" | "SUBSCRIBE" | "DONATION" | "RAID" | "CLIP";

export type AlertData = {
  type: AlertType;
  username: string;
  displayName?: string;
  amountCents?: number;
  tierName?: string;
  message?: string;
  timestamp: Date;
};

export type StreamAlertConfig = {
  showFollowAlert: boolean;
  showSubscribeAlert: boolean;
  showDonationAlert: boolean;
  showRaidAlert: boolean;
  showClipAlert: boolean;
  alertStyle: "slide-up" | "pop" | "fade" | "bounce";
  alertDurationMs: number;
  alertSoundEnabled: boolean;
};

// ──────────────────────────────────────────────────────────────────────────
// ALERT CONFIG (streamer side)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Lấy alert config của streamer.
 * Tạo default config nếu chưa có.
 */
export const getAlertConfig = async (streamerId: string): Promise<StreamAlertConfig> => {
  let config = await db.streamAlert.findUnique({
    where: { streamerId },
  });

  if (!config) {
    config = await db.streamAlert.create({
      data: { streamerId },
    });
  }

  return {
    showFollowAlert: config.showFollowAlert,
    showSubscribeAlert: config.showSubscribeAlert,
    showDonationAlert: config.showDonationAlert,
    showRaidAlert: config.showRaidAlert,
    showClipAlert: config.showClipAlert,
    alertStyle: config.alertStyle as StreamAlertConfig["alertStyle"],
    alertDurationMs: config.alertDurationMs,
    alertSoundEnabled: config.alertSoundEnabled,
  };
};

/**
 * Update alert config.
 */
export const updateAlertConfig = async (
  streamerId: string,
  updates: Partial<StreamAlertConfig>
) => {
  return db.streamAlert.update({
    where: { streamerId },
    data: {
      ...(updates.showFollowAlert !== undefined && { showFollowAlert: updates.showFollowAlert }),
      ...(updates.showSubscribeAlert !== undefined && { showSubscribeAlert: updates.showSubscribeAlert }),
      ...(updates.showDonationAlert !== undefined && { showDonationAlert: updates.showDonationAlert }),
      ...(updates.showRaidAlert !== undefined && { showRaidAlert: updates.showRaidAlert }),
      ...(updates.showClipAlert !== undefined && { showClipAlert: updates.showClipAlert }),
      ...(updates.alertStyle !== undefined && { alertStyle: updates.alertStyle }),
      ...(updates.alertDurationMs !== undefined && { alertDurationMs: updates.alertDurationMs }),
      ...(updates.alertSoundEnabled !== undefined && { alertSoundEnabled: updates.alertSoundEnabled }),
    },
  });
};

// ──────────────────────────────────────────────────────────────────────────
// ALERT TRIGGERS (called by subscription/donation/follow services)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build alert data từ event type + metadata.
 * Trả về null nếu streamer disable alert type này.
 *
 * Gọi hàm này khi: subscribe, donate, follow.
 *
 * Ngoài việc build data, còn publish qua LiveKit Room data channel để
 * tất cả participants trong room (kể cả streamer) nhận được alert real-time.
 *
 * Trade-off:
 *   - LiveKit Data Channel: real-time, không cần thêm infra, nhưng chỉ
 *     nhận được nếu streamer ĐÃ JOIN room (đang ở dashboard `/u/[name]/home`).
 *     Nếu streamer chưa join → fallback polling.
 *   - Polling: luôn hoạt động nhưng thêm 1 endpoint và độ trễ ~5-10s.
 */
export const buildAlert = async (params: {
  streamerId: string;
  type: AlertType;
  username: string;
  displayName?: string;
  amountCents?: number;
  tierName?: string;
  message?: string;
}): Promise<AlertData | null> => {
  const config = await getAlertConfig(params.streamerId);

  // Check if this alert type is enabled.
  const shouldShow =
    (params.type === "FOLLOW" && config.showFollowAlert) ||
    (params.type === "SUBSCRIBE" && config.showSubscribeAlert) ||
    (params.type === "DONATION" && config.showDonationAlert) ||
    (params.type === "RAID" && config.showRaidAlert) ||
    (params.type === "CLIP" && config.showClipAlert);

  if (!shouldShow) return null;

  const alert: AlertData = {
    type: params.type,
    username: params.username,
    displayName: params.displayName,
    amountCents: params.amountCents,
    tierName: params.tierName,
    message: params.message,
    timestamp: new Date(),
  };

  // Publish to LiveKit Room data channel (non-blocking, fail-open).
  // Tất cả participants trong room sẽ nhận event 'lk-data' → AlertQueue.
  await publishAlertToRoom(params.streamerId, alert).catch((err) => {
    console.warn("[buildAlert] LiveKit publish failed:", err);
  });

  return alert;
};

/**
 * Publish 1 alert lên LiveKit Room data channel.
 *
 * Sử dụng RoomServiceClient.sendData() — payload là JSON-encoded alert.
 * AlertQueue component lắng nghe qua room.on('dataReceived', ...).
 *
 * Fail-open: log warning nhưng KHÔNG throw — alert đã build OK, DB vẫn
 * được persist. Streamer có thể xem lại qua Recent Alerts sau.
 */
async function publishAlertToRoom(
  streamerId: string,
  alert: AlertData
): Promise<void> {
  const apiUrl = process.env.LIVEKIT_API_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiUrl || !apiKey || !apiSecret) {
    console.warn(
      "[publishAlertToRoom] LiveKit env chưa được set — bỏ qua publish."
    );
    return;
  }

  try {
    const { RoomServiceClient } = await import("livekit-server-sdk");
    const roomService = new RoomServiceClient(apiUrl, apiKey, apiSecret);

    const payload = JSON.stringify({
      kind: "alert",
      alert: {
        ...alert,
        timestamp: alert.timestamp.toISOString(),
      },
    });
    const data = new TextEncoder().encode(payload);

    // Room name = userId của streamer. Topic giúp client lọc event dễ dàng.
    // sendData signature: (room, data, kind: DataPacket_Kind, options: SendDataOptions).
    // DataPacket_Kind.RELIABLE = 1 → đảm bảo delivery.
    const { DataPacket_Kind } = await import("livekit-server-sdk");
    await roomService.sendData(
      streamerId,
      data,
      DataPacket_Kind.RELIABLE,
      { topic: "alert" }
    );
  } catch (err) {
    // Fail-open: log warning, không throw.
    console.warn(
      "[publishAlertToRoom] Không thể publish alert:",
      err instanceof Error ? err.message : err
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// ALERT STYLE CONFIG (for UI)
// ──────────────────────────────────────────────────────────────────────────

export const ALERT_STYLES = [
  { value: "slide-up", label: "Slide Up" },
  { value: "pop", label: "Pop" },
  { value: "fade", label: "Fade In" },
  { value: "bounce", label: "Bounce" },
] as const;

export const ALERT_ICONS: Record<AlertType, string> = {
  FOLLOW: "👋",
  SUBSCRIBE: "⭐",
  DONATION: "💸",
  RAID: "🚀",
  CLIP: "🎬",
};

export const ALERT_TITLES: Record<AlertType, string> = {
  FOLLOW: "New Follower!",
  SUBSCRIBE: "New Subscriber!",
  DONATION: "Donation!",
  RAID: "Incoming Raid!",
  CLIP: "New Clip!",
};
