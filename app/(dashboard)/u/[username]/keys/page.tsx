import React from "react";

import { getSelf } from "@/lib/auth-service";
import { getStreamByUserId } from "@/lib/stream-service";

import { URLCard } from "./_components/url-card";
import { KeyCard } from "./_components/key-card";
import { ConnectModal } from "./_components/connect-modal";
import { EndLiveButton } from "./_components/end-live-button";
import { GoLiveButton } from "./_components/go-live-button";

// Fix vấn đề 2 FIX-PROMPT-2.md: thêm nút "Bắt đầu Live" khi stream chưa live.

export default async function KeysPage() {
  const self = await getSelf();
  const stream = await getStreamByUserId(self.id);

  if (!stream) {
    throw new Error("No stream found");
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Khóa & URL</h1>
        <div className="flex items-center gap-2">
          <GoLiveButton streamId={stream.id} isLive={stream.isLive} />
          <EndLiveButton streamId={stream.id} isLive={stream.isLive} />
          <ConnectModal />
        </div>
      </div>
      <div className="space-y-4">
        <URLCard value={stream.serverUrl} />
        <KeyCard value={stream.streamKey} />
      </div>
    </div>
  );
}
