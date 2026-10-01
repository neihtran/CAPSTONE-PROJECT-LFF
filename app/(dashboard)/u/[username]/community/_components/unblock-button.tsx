"use client";

import React, { useTransition } from "react";
import { toast } from "sonner";

import { onUnblock } from "@/actions/block";
import { Button } from "@/components/ui/button";

export function UnblockButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(() => {
      onUnblock(userId)
        .then((result) =>
          toast.success(`Đã bỏ chặn ${result.blocked.username}`)
        )
        .catch(() => toast.error("Đã xảy ra lỗi"));
    });
  };

  return (
    <Button
      disabled={isPending}
      onClick={onClick}
      variant="link"
      size="sm"
      className="text-blue-500 w-full"
    >
      Bỏ chặn
    </Button>
  );
}
