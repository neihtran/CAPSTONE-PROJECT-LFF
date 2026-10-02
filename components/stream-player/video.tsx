"use client";

/**
 * Video — wrapper render video player theo trạng thái video State.
 *
 * Bug 1 fix: 4 nhánh state rõ ràng thay vì 3 nhánh cũ (chỉ hiển thị "Disconnected" trống).
 *
 *   - Connected + has remote + has tracks → `<LiveVideo />` (bình thường).
 *   - Connected + no remote              → `<StreamStatusOverlay />` (Đang chờ OBS).
 *   - Disconnected                       → `<StreamStatusOverlay />` + Retry button.
 *   - Connecting/Reconnecting            → `<LoadingVideo />` (giữ tương thích cũ).
 */

import React from "react";
import { ConnectionState, Track } from "livekit-client";
import {
  useConnectionState,
  useRemoteParticipant,
  useTracks,
} from "@livekit/components-react";
import { useRouter } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";

import { OfflineVideo } from "./offline-video";
import { LoadingVideo } from "./loading-video";
import { LiveVideo } from "./live-video";
import { StreamStatusOverlay } from "./stream-status-overlay";

export function Video({
  hostName,
  hostIdentity,
  isOwner = false,
}: {
  hostName: string;
  hostIdentity: string;
  /** True nếu viewer đang xem là chính streamer (owner). */
  isOwner?: boolean;
}) {
  const connectionState = useConnectionState();
  const participant = useRemoteParticipant(hostIdentity);
  const tracks = useTracks([
    Track.Source.Camera,
    Track.Source.Microphone,
  ]).filter((track) => track.participant.identity === hostIdentity);
  const router = useRouter();

  /**
   * Retry handler — trigger reconnect LiveKit Room.
   *
   * `router.refresh()` sẽ re-fetch server component → component `<LiveKitRoom>`
   * sẽ mount lại với token mới từ `useViewerToken`.
   *
   * Nếu không đủ, dùng `window.location.reload()` để force reconnect.
   */
  const handleRetry = () => {
    router.refresh();
    // Fallback nếu router.refresh() không reconnect LiveKitRoom:
    setTimeout(() => {
      if (
        document.visibilityState === "visible" &&
        connectionState === ConnectionState.Disconnected
      ) {
        window.location.reload();
      }
    }, 3000);
  };

  let content;

  // Case 1: Live OK — Connected + có remote participant + có tracks.
  if (
    connectionState === ConnectionState.Connected &&
    participant &&
    tracks.length > 0
  ) {
    content = <LiveVideo participant={participant} />;
  }
  // Case 2: Connected nhưng OBS chưa stream → "Đang chờ OBS".
  else if (
    connectionState === ConnectionState.Connected &&
    !participant
  ) {
    content = (
      <StreamStatusOverlay
        connectionState={connectionState}
        hasRemoteParticipant={false}
        hostName={hostName}
        isOwner={isOwner}
      />
    );
  }
  // Case 3: Disconnected → "Mất kết nối" + Retry.
  else if (connectionState === ConnectionState.Disconnected) {
    content = (
      <StreamStatusOverlay
        connectionState={connectionState}
        hasRemoteParticipant={!!participant}
        hostName={hostName}
        isOwner={isOwner}
        onRetry={handleRetry}
      />
    );
  }
  // Case 4: Connecting / Reconnecting → giữ LoadingVideo cho tương thích.
  else {
    content = <LoadingVideo label={connectionState} />;
  }

  return <div className="aspect-video border-b group relative">{content}</div>;
}

export function VideoSkeleton() {
  return (
    <div className="aspect-video border-x border-background">
      <Skeleton className="h-full w-full rounded-none" />
    </div>
  );
}