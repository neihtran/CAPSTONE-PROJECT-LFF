"use client";

import React from "react";

import { EndLiveButton } from "@/app/(dashboard)/u/[username]/keys/_components/end-live-button";

/**
 * EndLiveFab — Floating Action Button "Kết thúc Live" hiện trên trang
 * /(home) của dashboard.
 *
 * Vì sao cần component này:
 *   - Trang (home) là server component, không thể nhúng button client trực tiếp.
 *   - Streamer đang live mà muốn end → trước đây phải vào /keys → UX kém.
 *
 * Hiển thị: nổi góc phải-dưới, chỉ khi isLive=true.
 */
export function EndLiveFab({
  streamId,
  isLive,
}: {
  streamId: string;
  isLive: boolean;
}) {
  if (!isLive) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 shadow-lg rounded-md overflow-hidden">
      <EndLiveButton streamId={streamId} isLive={isLive} />
    </div>
  );
}
