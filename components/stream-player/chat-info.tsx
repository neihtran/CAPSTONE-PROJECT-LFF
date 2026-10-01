import React, { useMemo } from "react";
import { Info } from "lucide-react";

import { Hint } from "@/components/hint";

export function ChatInfo({
  isDelayed,
  isFollowersOnly,
  isChatDisabled,
}: {
  isDelayed: boolean;
  isFollowersOnly: boolean;
  /**
   * Streamer đang tắt chat — ưu tiên hiển thị thông báo này trước các thông báo khác.
   */
  isChatDisabled?: boolean;
}) {
  const hint = useMemo(() => {
    // Ưu tiên cao nhất: chat đã bị tắt hoàn toàn.
    if (isChatDisabled) {
      return "Chat đã bị chủ kênh tắt";
    }

    if (isFollowersOnly && !isDelayed) {
      return "Chỉ người theo dõi mới có thể chat";
    }

    if (isDelayed && !isFollowersOnly) {
      return "Chat bị trì hoãn 3 giây";
    }

    if (isFollowersOnly && isDelayed) {
      return "Chỉ người theo dõi mới có thể chat, chat bị trì hoãn 3 giây";
    }

    return "";
  }, [isChatDisabled, isDelayed, isFollowersOnly]);

  const label = useMemo(() => {
    if (isChatDisabled) {
      return "Chat đã tắt";
    }

    if (isFollowersOnly && !isDelayed) {
      return "Chỉ người theo dõi";
    }

    if (isDelayed && !isFollowersOnly) {
      return "Chế độ chậm";
    }

    if (isFollowersOnly && isDelayed) {
      return "Chỉ người theo dõi & chế độ chậm";
    }

    return "";
  }, [isChatDisabled, isDelayed, isFollowersOnly]);

  if (!isDelayed && !isFollowersOnly && !isChatDisabled) return null;

  return (
    <div
      className={cn(
        "p-2 bg-white/5 border border-white/10 w-full rounded-t-md flex items-center gap-x-2",
        isChatDisabled
          ? "text-red-400"
          : "text-muted-foreground"
      )}
    >
      <Hint label={hint}>
        <Info className="h-4 w-4" />
      </Hint>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}

// Inline cn helper — tránh import từ "@/lib/utils" cho đơn giản.
// (Giữ nguyên behavior như cn gốc.)
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
