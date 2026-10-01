"use client";

import React from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { ChatMessage } from "./chat-message";

/**
 * ChatItem — union type cho messages hiển thị trong ChatList.
 * Có thể là live message từ LiveKit HOẶC lịch sử từ DB.
 *
 * Cả 2 đều có: id, message, timestamp, from (identity/name).
 * ChatMessage component chỉ cần các field này.
 */
export type ChatItem = {
  id?: string;
  message: string;
  timestamp: number;
  from: { identity?: string; name?: string };
};

export function ChatList({
  isHidden,
  messages,
  isChatDisabled,
}: {
  messages: ChatItem[];
  isHidden: boolean;
  /**
   * Streamer vừa tắt chat — hiện thông báo BÊN TRÊN messages,
   * nhưng KHÔNG xóa lịch sử chat cũ.
   */
  isChatDisabled?: boolean;
}) {
  if (isHidden) {
    // Host offline / stream chưa live → ẩn hẳn cả danh sách.
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Chat đã bị tắt</p>
      </div>
    );
  }

  // Chat tắt nhưng host đang online → vẫn hiện lịch sử, kèm banner.
  if (isChatDisabled && (!messages || messages.length === 0)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-red-400">Chat đã bị chủ kênh tắt</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col-reverse overflow-y-auto p-3 h-full">
      {/* Banner khi chat tắt — hiện phía trên messages, không xóa lịch sử. */}
      {isChatDisabled && (
        <div className="mb-2 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
          Chat đã bị chủ kênh tắt — tin nhắn cũ được giữ lại
        </div>
      )}
      {messages.map((message, idx) => (
        <ChatMessage
          key={message.id ?? `${message.timestamp}-${idx}`}
          data={message}
        />
      ))}
    </div>
  );
}

export function ChatListSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <Skeleton className="w-1/2 h-6" />
    </div>
  );
}
