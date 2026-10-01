"use client";

import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";

/**
 * ChatEnabledState — state lưu trên LiveKit Room metadata.
 *
 * Streamer (broadcaster) ghi vào Room metadata khi toggle chat ở dashboard.
 * Viewer/Streamer subscribe qua hook này để nhận update real-time không cần navigate.
 *
 * Room metadata là một chuỗi string JSON (xem Room.metadata docs):
 *   https://docs.livekit.io/home/client/data/room-metadata/
 *
 * Format:
 *   { "isChatEnabled": true, "isChatDelayed": false, "isChatFollowersOnly": false }
 */

type ChatEnabledState = {
  isChatEnabled: boolean;
  isChatDelayed: boolean;
  isChatFollowersOnly: boolean;
};

const DEFAULT_STATE: ChatEnabledState = {
  isChatEnabled: true,
  isChatDelayed: false,
  isChatFollowersOnly: false,
};

/** Parse Room.metadata JSON an toàn. */
const parseRoomMetadata = (raw: unknown): ChatEnabledState => {
  if (typeof raw !== "string" || !raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw);
    return {
      isChatEnabled: parsed?.isChatEnabled ?? DEFAULT_STATE.isChatEnabled,
      isChatDelayed: parsed?.isChatDelayed ?? DEFAULT_STATE.isChatDelayed,
      isChatFollowersOnly:
        parsed?.isChatFollowersOnly ?? DEFAULT_STATE.isChatFollowersOnly,
    };
  } catch {
    return DEFAULT_STATE;
  }
};

/**
 * Deep-equal 2 ChatEnabledState.
 */
const isEqual = (a: ChatEnabledState, b: ChatEnabledState) =>
  a.isChatEnabled === b.isChatEnabled &&
  a.isChatDelayed === b.isChatDelayed &&
  a.isChatFollowersOnly === b.isChatFollowersOnly;

/**
 * Hook subscribe LiveKit Room metadata để lấy trạng thái chat real-time.
 *
 * QUAN TRỌNG: phải dùng BÊN TRONG <LiveKitRoom> vì cần useRoomContext().
 *
 * NGUYÊN TẮC ƯU TIÊN (3 nguồn):
 *  1. Server initial state (từ DB, qua server component) — highest priority khi mount.
 *     LUÔN đúng khi user fresh navigate vào trang.
 *  2. Room metadata (từ LiveKit) — chỉ dùng khi broadcaster ĐÃ update metadata
 *     (tức metadata khác initialState). Nếu metadata = initialState thì bỏ qua
 *     (tránh stale read).
 *  3. Event RoomMetadataChanged — broadcaster toggle chat → metadata update →
 *     tất cả clients nhận event → update state real-time.
 *
 * @param initialState - state từ DB (server component). Luôn đúng khi fresh navigate.
 */
export const useChatEnabled = (
  initialState: ChatEnabledState
): ChatEnabledState => {
  const room = useRoomContext();
  // Luôn khởi tạo = server state (ground-truth khi navigate).
  const [state, setState] = useState<ChatEnabledState>(initialState);

  useEffect(() => {
    // Sau mount, đọc metadata 1 lần. Nếu metadata khác initialState → broadcaster
    // đã update (vd: đã tắt chat trước khi mình join room), dùng metadata.
    // Nếu metadata == initialState → bỏ qua, giữ initialState (server đã đúng).
    const current = parseRoomMetadata(room.metadata);
    if (!isEqual(current, initialState)) {
      setState(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← Chỉ chạy 1 lần sau mount

  useEffect(() => {
    // Lắng nghe event — broadcaster toggle chat sau khi user đã ở trong room.
    const handleMetadataChanged = (metadata: unknown) => {
      const next = parseRoomMetadata(metadata);
      setState((prev) => (isEqual(prev, next) ? prev : next));
    };

    room.on(RoomEvent.RoomMetadataChanged, handleMetadataChanged);

    return () => {
      room.off(RoomEvent.RoomMetadataChanged, handleMetadataChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]); // ← re-bind khi room instance thay đổi (disconnect/reconnect)

  return state;
};
