"use client";

import React, { useEffect } from "react";
import Link from "next/link";

/**
 * Global error boundary — fallback CUỐI CÙNG khi root error boundary cũng throw.
 *
 * Theo Next.js docs, file này PHẢI có `<html>` và `<body>` vì nó replace
 * toàn bộ root layout khi root error cũng fail.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "2rem", margin: "0 0 1rem" }}>
            Lỗi nghiêm trọng
          </h1>
          <p style={{ color: "#666", maxWidth: "32rem", marginBottom: "1.5rem" }}>
            Hệ thống gặp sự cố nghiêm trọng. Vui lòng tải lại trang hoặc quay
            về trang chủ sau vài phút.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                background: "#374151",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              Thử lại
            </button>
            <a
              href="/"
              style={{
                padding: "0.5rem 1rem",
                background: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                textDecoration: "none",
              }}
            >
              Trang chủ
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
