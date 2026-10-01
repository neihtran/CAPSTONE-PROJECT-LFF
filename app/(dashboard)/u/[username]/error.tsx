"use client";

import React, { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Error boundary cho route dashboard `/u/[username]/*`.
 *
 * Nếu live stream API lỗi (không lấy được token, ingress fail...) — streamer
 * vẫn thấy error UI thay vì crash.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/(dashboard)/u/[username]/error]", error);
  }, [error]);

  return (
    <div className="h-full flex flex-col space-y-4 items-center justify-center text-muted-foreground px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Không thể tải dashboard
        </h2>
        <p className="text-sm">
          Có lỗi xảy ra khi tải dashboard. Vui lòng thử lại.
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
