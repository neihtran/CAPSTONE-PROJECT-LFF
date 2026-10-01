import React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="h-full flex flex-col space-y-4 items-center justify-center text-muted-foreground">
      <h1 className="text-4xl">404</h1>
      <p>Không tìm thấy trang bạn đang tìm kiếm.</p>
      <Button variant="secondary" asChild>
        <Link href="/">Quay về trang chủ</Link>
      </Button>
    </div>
  );
}
