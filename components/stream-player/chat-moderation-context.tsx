"use client";

import React, { createContext, useContext } from "react";

/**
 * ChatModerationContext — cung cấp thông tin moderation cho tất cả
 * ChatMessage components.
 *
 * Lý do dùng context thay vì prop drilling: ChatMessage nằm sâu trong
 * ChatList → ChatItem → mỗi message cần biết:
 *   - streamId: để gọi timeout/ban/delete.
 *   - isModerator: có phải mod/owner không.
 *   - currentUserId: để ẩn nút mod trên message của chính mình.
 *
 * Set 1 lần ở Chat root → tất cả messages dùng.
 */

type ChatModerationContextValue = {
  streamId: string;
  isModerator: boolean;
  currentUserId: string | null;
};

const ChatModerationContext = createContext<ChatModerationContextValue | null>(
  null
);

export function ChatModerationProvider({
  streamId,
  isModerator,
  currentUserId,
  children,
}: ChatModerationContextValue & { children: React.ReactNode }) {
  return (
    <ChatModerationContext.Provider
      value={{ streamId, isModerator, currentUserId }}
    >
      {children}
    </ChatModerationContext.Provider>
  );
}

export function useChatModeration() {
  const ctx = useContext(ChatModerationContext);
  if (!ctx) {
    // Không có provider → disable moderation (chỉ cho phép report).
    return {
      streamId: null,
      isModerator: false,
      currentUserId: null,
    };
  }
  return ctx;
}
