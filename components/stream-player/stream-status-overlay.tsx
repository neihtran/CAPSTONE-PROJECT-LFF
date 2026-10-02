"use client";

/**
 * StreamStatusOverlay — overlay hiển thị trạng thái video player.
 *
 * Bug 1 fix: thay vì hiển thị "Disconnected" trống trơn khi LiveKit Room
 * chưa connect / OBS chưa stream → hiển thị thông báo rõ ràng cho từng
 * trạng thái:
 *
 *   1. `Disconnected`     → "Mất kết nối LiveKit" + nút Retry.
 *   2. `Connecting`       → "Đang kết nối LiveKit..." + spinner.
 *   3. `Reconnecting`     → "Đang kết nối lại..." + spinner.
 *   4. `Connected` + no remote → "Đang chờ video từ OBS" + helper link
 *                               (chỉ cho chính streamer — isOwner=true).
 *
 * Khi `Connected` + có remote participant → return null (để LiveVideo
 * component tự render).
 */

import React from "react";
import { ConnectionState } from "livekit-client";
import { Camera, Loader, RefreshCcw, WifiOff } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export type StreamStatusOverlayProps = {
  /** Trạng thái LiveKit Room hiện tại. */
  connectionState: ConnectionState;
  /** True nếu đã thấy remote participant (OBS đã stream video lên). */
  hasRemoteParticipant: boolean;
  /** Hostname của streamer — dùng cho helper link đến /keys. */
  hostName: string;
  /** True nếu viewer đang xem là chính streamer (owner) → show helper link. */
  isOwner?: boolean;
  /** Callback khi user click Retry (chỉ dùng cho state Disconnected). */
  onRetry?: () => void;
};

/**
 * Render overlay tương ứng với trạng thái LiveKit.
 *
 * @param props - xem StreamStatusOverlayProps.
 * @returns ReactNode hoặc null nếu state OK (return LiveVideo).
 */
export function StreamStatusOverlay({
  connectionState,
  hasRemoteParticipant,
  hostName,
  isOwner = false,
  onRetry,
}: StreamStatusOverlayProps) {
  // Case 4: Connected + có remote participant → trả về null để
  // LiveVideo component ở parent được render.
  if (
    connectionState === ConnectionState.Connected &&
    hasRemoteParticipant
  ) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="h-full w-full flex flex-col items-center justify-center gap-4 p-6 bg-background"
    >
      {connectionState === ConnectionState.Disconnected && (
        <>
          <WifiOff className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1 text-center">
            <p className="font-semibold">Mất kết nối LiveKit</p>
            <p className="text-sm text-muted-foreground">
              Không thể kết nối tới server LiveKit. Vui lòng thử lại.
            </p>
          </div>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="secondary"
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Thử lại
            </Button>
          )}
        </>
      )}

      {(connectionState === ConnectionState.Connecting ||
        connectionState === ConnectionState.Reconnecting) && (
        <>
          <Loader className="h-10 w-10 text-muted-foreground animate-spin" />
          <div className="space-y-1 text-center">
            <p className="font-semibold">Đang kết nối...</p>
            <p className="text-sm text-muted-foreground">
              Đang thiết lập kết nối LiveKit
            </p>
          </div>
        </>
      )}

      {connectionState === ConnectionState.Connected &&
        !hasRemoteParticipant && (
          <>
            <Camera className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1 text-center max-w-md">
              <p className="font-semibold">Đang chờ video từ OBS</p>
              <p className="text-sm text-muted-foreground">
                LiveKit Room đã kết nối. Bật OBS / streaming software và bắt
                đầu stream tới URL + Stream Key trong trang <strong>Keys</strong>.
              </p>
              {isOwner && (
                <Link
                  href={`/u/${hostName}/keys`}
                  className="inline-block mt-2 text-sm text-primary underline"
                >
                  → Mở trang Keys
                </Link>
              )}
            </div>
          </>
        )}
    </div>
  );
}