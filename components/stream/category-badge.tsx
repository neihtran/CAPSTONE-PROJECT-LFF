"use client";

import React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * CategoryBadge — chip hiển thị 1 category với link đến /browse/[slug].
 *
 * Dùng trong ResultCard để viewer click → trang category.
 *
 * NOTE: file này PHẢI là "use client" vì dùng onClick={(e) => e.stopPropagation()}
 * để ngăn việc click vào CategoryBadge lan ra Link cha (điều hướng tới trang
 * streamer). Nếu là Server Component, Next.js sẽ crash với lỗi:
 *   "Event handlers cannot be passed to Client Component props"
 */
export function CategoryBadge({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  return (
    <Link
      href={`/browse/${slug}`}
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium",
        "bg-primary/10 text-primary border border-primary/20",
        "hover:bg-primary/20 transition-colors",
        "truncate max-w-32",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {name}
    </Link>
  );
}

export function CategoryBadgeSkeleton() {
  return (
    <span className="inline-block h-4 w-16 bg-muted rounded animate-pulse" />
  );
}
