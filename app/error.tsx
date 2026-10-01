"use client";

import React, { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Root error boundary — bắt mọi lỗi không mong muốn ở bất kỳ route nào trong app.
 *
 * Theo Next.js App Router, file này PHẢI là "use client" và PHẢI export default.
 *
 * Props `error` chứa Error object, `reset` là callback để retry render segment.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log lỗi ra console để debug. Production sẽ thay bằng Sentry sau.
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="h-full flex flex-col space-y-4 items-center justify-center text-muted-foreground px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Đã xảy ra lỗi
        </h2>
        <p className="text-sm">
          Hệ thống gặp sự cố không mong muốn. Vui lòng thử lại hoặc quay về
          trang chủ.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 mt-2 font-mono">
            Mã lỗi: {error.digest}
          </p>
        )}
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
