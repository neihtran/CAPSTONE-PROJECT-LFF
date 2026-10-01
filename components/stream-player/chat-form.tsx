"use client";

import React, { useState } from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { ChatInfo } from "./chat-info";

export function ChatForm({
  value,
  isDelayed,
  isFollowersOnly,
  isFollowing,
  isHidden,
  isChatDisabled,
  isModerating,
  onChange,
  onSubmit,
}: {
  onSubmit: () => void;
  onChange: (value: string) => void;
  value: string;
  isHidden: boolean;
  isFollowersOnly: boolean;
  isDelayed: boolean;
  isFollowing: boolean;
  /**
   * Đang chờ OpenAI Moderation API trả lời — disable nút gửi để UX không giật
   * và tránh user spam gửi nhiều lần trong lúc moderation đang xử lý.
   */
  isModerating?: boolean;
  /**
   * Chủ kênh vừa tắt chat (real-time từ Room metadata).
   * Form vẫn hiển thị nhưng input + button đều disabled, hiện message rõ ràng
   * cho viewer biết lý do không gửi được.
   */
  isChatDisabled?: boolean;
}) {
  const [isDelayBlocked, setIsDelayBlocked] = useState(false);

  const isFollowersOnlyAndNotFollowing = isFollowersOnly && !isFollowing;
  const isDisabled =
    isHidden ||
    isChatDisabled ||
    isDelayBlocked ||
    isFollowersOnlyAndNotFollowing ||
    isModerating;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!value || isDisabled) return;

    if (isDelayed && !isDelayBlocked) {
      setIsDelayBlocked(true);
      setTimeout(() => {
        setIsDelayBlocked(false);
        onSubmit();
      }, 3000);
    } else {
      onSubmit();
    }
  };

  if (isHidden) {
    return null;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col items-center gap-y-2 p-3"
    >
      <div className="w-full">
        <ChatInfo
          isDelayed={isDelayed}
          isFollowersOnly={isFollowersOnly}
          isChatDisabled={isChatDisabled}
        />
        <Input
          onChange={(e) => onChange(e.target.value)}
          value={value}
          disabled={isDisabled}
          maxLength={500}
          placeholder={
            isChatDisabled
              ? "Chat đã bị chủ kênh tắt"
              : "Gửi tin nhắn"
          }
          className={cn(
            "border-white/10",
            (isFollowersOnly || isDelayed || isChatDisabled) &&
              "rounded-t-none border-t-0"
          )}
        />
      </div>
      <div className="ml-auto">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isDisabled}
        >
          {isModerating
            ? "Đang kiểm tra..."
            : isChatDisabled
            ? "Đã tắt"
            : "Gửi"}
        </Button>
      </div>
    </form>
  );
}

export function ChatFormSkeleton() {
  return (
    <div className="flex flex-col items-center gap-y-4 p-3">
      <Skeleton className="w-full h-10" />
      <div className="flex items-center gap-x-2 ml-auto">
        <Skeleton className="h-7 w-7" />
        <Skeleton className="h-7 w-12" />
      </div>
    </div>
  );
}
