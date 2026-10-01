"use client";

import React, { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Error boundary cho route `/[username]` (creator public page).
 *
 * Nếu live stream API lỗi (LiveKit token fail, ingress down, ...) — viewer vẫn
 * thấy friendly error thay vì trắng trang.
 */
export default function StreamerPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/(browse)/[username]/error]", error);
  }, [error]);

  return (
    <div className="h-full flex flex-col space-y-4 items-center justify-center text-muted-foreground px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Không thể tải trang streamer
        </h2>
        <p className="text-sm">
          Trang này có thể đang gặp sự cố tạm thời. Vui lòng thử lại.
        </p>
      </div>
      <div className="flex gap-x-2">
        <Button variant="secondary" onClick={() => reset()}>
          Thử lại
        </Button>
        <Button variant="primary" asChild>
          <Link href="/">Trang chủ</Link>
        </Button>
      </div>
    </div>
  );
}
