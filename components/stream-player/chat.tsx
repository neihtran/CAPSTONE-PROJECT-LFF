"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "usehooks-ts";
import { toast } from "sonner";
import {
  useChat,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

import { ChatVariant, useChatSidebar } from "@/store/use-chat-sidebar";
import { useChatEnabled } from "@/hooks/use-chat-enabled";
import { type HistoryItem as HistoryItemType } from "@/lib/chat-service";

import { ChatHeader, ChatHeaderSkeleton } from "./chat-header";
import { ChatForm, ChatFormSkeleton } from "./chat-form";
import { ChatList, ChatListSkeleton, type ChatItem } from "./chat-list";
import { ChatCommunity } from "./chat-community";
import { ChatModerationProvider } from "./chat-moderation-context";

export function Chat({
  hostName,
  hostIdentity,
  viewerName,
  isFollowing,
  isChatEnabled,
  isChatDelayed,
  isChatFollowersOnly,
  // Moderation props.
  streamId,
  isModerator,
  currentUserId,
}: {
  hostName: string;
  hostIdentity: string;
  viewerName: string;
  isFollowing: boolean;
  isChatEnabled: boolean;
  isChatDelayed: boolean;
  isChatFollowersOnly: boolean;
  // Moderation props.
  streamId: string | null;
  isModerator: boolean;
  currentUserId: string | null;
}) {
  const matches = useMediaQuery("(max-width: 1024px)");
  const { variant, onExpand } = useChatSidebar((state) => state);
  const connectionState = useConnectionState();
  // `isOnline` check dựa trên LiveKit CONNECTION STATE, không dựa vào remote participant.
  //
  // Bug trước đây: dùng `participant && Connected` → không tự thấy mình là remote participant
  // → streamer mở trang của mình LUÔN thấy isOnline=false → isOffline=true → ẨN HẾT messages
  // dù stream vẫn đang live.
  //
  // Fix: chỉ cần connectionState === Connected là đủ. Khi LiveKit Room connect (dù là
  // broadcaster hay viewer), ta coi như stream đang live.
  const isOnline = connectionState === ConnectionState.Connected;

  // Subscribe Room metadata real-time.
  // Initial state từ DB (server component), update real-time khi broadcaster toggle.
  const chatState = useChatEnabled({
    isChatEnabled,
    isChatDelayed,
    isChatFollowersOnly,
  });

  // `isOffline` — CHỈ true khi host thực sự không online (chưa join LiveKit room).
  // Tách riêng khỏi isChatDisabled vì 2 trạng thái có UI khác nhau:
  // - isOffline = true → ẩn cả ChatList + ChatForm (host chưa lên sóng)
  // - isChatDisabled = true → vẫn hiện ChatList (kèm banner + lịch sử), chỉ ẩn ChatForm
  // Trước đây bug: !isChatEnabled || !isOnline → khi tắt chat thì isOffline=true → ẩn hết messages.
  const isOffline = !isOnline;
  // `isChatDisabled` riêng — chỉ true khi streamer TẮT chat (vẫn cần hiện lịch sử
  // chat cũ + banner "Chat đã bị chủ kênh tắt" + form disabled).
  const isChatDisabled = !chatState.isChatEnabled;

  const [value, setValue] = useState("");
  // Loading state cho AI moderation — disable nút gửi trong lúc chờ OpenAI trả lời.
  const [isModerating, setIsModerating] = useState(false);
  // Lịch sử chat load từ DB khi mount (giữ qua refresh/toggle chat).
  // Format tương thích ReceivedChatMessage để merge liền mạch.
  const [history, setHistory] = useState<HistoryItemType[]>([]);
  // Flag để chỉ load history 1 lần tránh spam DB.
  const historyLoaded = useRef(false);

  const { chatMessages: liveMessages, send } = useChat();

  // Load lịch sử chat từ DB 1 lần khi mount.
  // Không depend vào isChatEnabled — vẫn load dù chat đang tắt hay bật.
  useEffect(() => {
    if (historyLoaded.current) return;
    historyLoaded.current = true;

    fetch(`/api/chat/history?streamId=${encodeURIComponent(hostIdentity)}`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data) => {
        if (Array.isArray(data?.messages)) {
          setHistory(data.messages as HistoryItemType[]);
        }
      })
      .catch((err) => {
        console.warn("[chat] Lỗi load history:", err);
      });
  }, [hostIdentity]);

  useEffect(() => {
    if (matches) {
      onExpand();
    }
  }, [matches, onExpand]);

  // Gộp lịch sử từ DB + tin nhắn live từ LiveKit.
// - DB history đã có .id unique → dùng làm key.
// - Live messages không có .id → dùng (timestamp + identity) làm key.
// Trùng key thì ưu tiên live (updated).
const historyKey = (m: HistoryItemType) => m.id;
const liveKey = (m: (typeof liveMessages)[number]) =>
  `${m.from?.identity ?? ""}-${m.timestamp}`;

const allMessages = useMemo<ChatItem[]>(() => {
  const seenIds = new Set<string>();
  const seenLiveKeys = new Set<string>();
  const merged: ChatItem[] = [];

  // 1) History từ DB — đã sort ASC sẵn từ server (lib/chat-service.ts), không sort lại.
  for (const m of history) {
    if (!seenIds.has(historyKey(m))) {
      seenIds.add(historyKey(m));
      seenLiveKeys.add(liveKey(m as unknown as (typeof liveMessages)[number]));
      merged.push(m);
    }
  }

  // 2) Live messages từ LiveKit DataChannel — append/update real-time.
  for (const m of liveMessages) {
    const k = liveKey(m);
    const idGuess = `live-${k}`;
    if (seenLiveKeys.has(k)) {
      const idx = merged.findIndex((x) => x.id === idGuess);
      if (idx >= 0) {
        merged[idx] = {
          id: idGuess,
          message: m.message,
          timestamp: m.timestamp,
          from: {
            identity: m.from?.identity ?? "",
            name: m.from?.name,
          },
        };
      }
      continue;
    }
    seenIds.add(idGuess);
    seenLiveKeys.add(k);
    merged.push({
      id: idGuess,
      message: m.message,
      timestamp: m.timestamp,
      from: {
        identity: m.from?.identity ?? "",
        name: m.from?.name,
      },
    });
  }

  // Final sort ASC — ChatList sẽ reverse (flex-col-reverse) để hiển thị mới nhất ở dưới.
  return merged.sort((a, b) => a.timestamp - b.timestamp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [history, liveMessages]);

  /**
   * Gửi tin nhắn qua LiveKit DataChannel.
   *
   * Luồng kiểm tra (defense in depth):
   *   1. Client-side gate: nếu streamer vừa tắt chat (state real-time) → chặn ngay,
   *      hiện toast, không gọi API.
   *   2. Server-side gate (api/chat/moderate): check stream.isChatEnabled trong DB.
   *      Nếu viewer bypass UI bằng DevTools, server vẫn chặn.
   *   3. AI moderation: OpenAI kiểm tra nội dung.
   *   4. Gửi qua LiveKit DataChannel.
   */
  const onSubmit = async () => {
    if (!send || !value.trim()) return;

    // Gate 1: client check trạng thái chat real-time.
    if (!chatState.isChatEnabled) {
      toast.error("Chat đã bị chủ kênh tắt");
      return;
    }

    // Bật loading state để UX không bị giật — disable nút gửi.
    setIsModerating(true);

    try {
      const response = await fetch("/api/chat/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Gửi kèm hostIdentity để server biết stream nào cần check.
        body: JSON.stringify({
          text: value,
          hostIdentity,
        }),
      });

      if (!response.ok) {
        // Lỗi HTTP (vd 423 chat-disabled, 500, ...) → không gửi, hiện message từ server.
        let serverMessage =
          "Không thể gửi tin nhắn. Vui lòng thử lại sau.";
        try {
          const data = await response.json();
          if (data?.error) serverMessage = data.error;
        } catch {
          // ignore — dùng message mặc định
        }
        toast.error(serverMessage);
        return;
      }

      const result = await response.json();

      if (result?.flagged) {
        toast.error(
          "Tin nhắn của bạn chứa nội dung không phù hợp và đã bị chặn."
        );
        return;
      }

      // Mọi thứ OK → gửi qua LiveKit DataChannel.
      send(value);
      setValue("");
    } catch (error) {
      console.error("[chat] Lỗi khi gọi moderation:", error);
      toast.error("Đã xảy ra lỗi mạng, không thể gửi tin nhắn.");
    } finally {
      setIsModerating(false);
    }
  };

  const onChange = (value: string) => {
    setValue(value);
  };

  return (
    <ChatModerationProvider
      streamId={streamId ?? ""}
      isModerator={isModerator}
      currentUserId={currentUserId}
    >
    <div className="flex flex-col bg-background border-l border-b pt-0 h-[calc(100vh-80px)]">
      <ChatHeader />
      {variant === ChatVariant.CHAT && (
        <>
          {/* ChatList KHÔNG bị ẩn khi streamer tắt chat — giữ lịch sử chat cũ.
              Khi host offline thì mới ẩn hẳn (isOffline). */}
          <ChatList
            messages={allMessages}
            isHidden={isOffline}
            isChatDisabled={isChatDisabled}
          />
          <ChatForm
            onSubmit={onSubmit}
            value={value}
            onChange={onChange}
            isHidden={isOffline}
            isChatDisabled={isChatDisabled}
            isFollowersOnly={chatState.isChatFollowersOnly}
            isDelayed={chatState.isChatDelayed}
            isFollowing={isFollowing}
            isModerating={isModerating}
          />
        </>
      )}
      {variant === ChatVariant.COMMUNITY && (
        <>
          <ChatCommunity
            hostName={hostName}
            viewerName={viewerName}
            isHidden={isOffline}
          />
        </>
      )}
    </div>
    </ChatModerationProvider>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex flex-col border-l border-b pt-0 h-[calc(100vh-80px)] border-2">
      <ChatHeaderSkeleton />
      <ChatListSkeleton />
      <ChatFormSkeleton />
    </div>
  );
}
