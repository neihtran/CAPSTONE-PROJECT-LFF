"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { CreateClipDialog } from "./create-clip-dialog";

/**
 * ClipsSection — sidebar liệt kê clips gần đây của stream + button tạo clip mới.
 *
 * Server component StreamPlayer có thể nhúng cái này vào layout để user
 * (đã login) có thể click "Tạo clip" từ trang xem.
 *
 * Props: streamId + streamName + viewerIdentity (để guard login).
 * Pass videoUrl = stream HLS URL (dùng cho clip).
 */
export function ClipsSection({
  streamId,
  streamUserId,
  streamName,
  videoUrl,
  isLoggedIn,
}: {
  streamId: string;
  streamUserId: string;
  streamName: string;
  videoUrl: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">Clips</h3>
        <button
          type="button"
          onClick={() => router.push(`/u/${encodeURIComponent(streamName)}/clips`)}
          className="text-xs text-primary hover:underline"
        >
          Xem tất cả →
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Tạo clip ngắn từ stream này để chia sẻ với bạn bè.
      </p>

      {isLoggedIn ? (
        <Button
          onClick={() => setShowDialog(true)}
          className="w-full"
          variant="default"
        >
          ✂️ Tạo clip
        </Button>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push("/sign-in")}
        >
          Đăng nhập để tạo clip
        </Button>
      )}

      <CreateClipDialog
        streamId={streamId}
        streamUserId={streamUserId}
        streamName={streamName}
        videoUrl={videoUrl}
        open={showDialog}
        onOpenChange={setShowDialog}
      />
    </div>
  );
}
