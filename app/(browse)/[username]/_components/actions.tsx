"use client";

import React, { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { onFollow, onUnfollow } from "@/actions/follow";
import { onBlock, onUnblock } from "@/actions/block";

/**
 * Extract error message từ Error object hoặc fallback.
 * Server actions throw Error với message tiếng Việt, client nhận qua reject.
 */
const extractError = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  return fallback;
};

export function Actions({
  isFollowing,
  userId,
}: {
  isFollowing: boolean;
  userId: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleFollow = () => {
    startTransition(() => {
      onFollow(userId)
        .then((data) =>
          toast.success(`Bạn đã theo dõi ${data.following.username}`)
        )
        .catch((error) =>
          toast.error(extractError(error, "Không thể theo dõi, vui lòng thử lại"))
        );
    });
  };

  const handleUnfollow = () => {
    startTransition(() => {
      onUnfollow(userId)
        .then((data) =>
          toast.success(`Bạn đã bỏ theo dõi ${data.following.username}`)
        )
        .catch((error) =>
          toast.error(extractError(error, "Không thể bỏ theo dõi, vui lòng thử lại"))
        );
    });
  };

  const handleBlock = () => {
    startTransition(() => {
      onBlock(userId)
        .then((data) =>
          toast.success(
            data
              ? `Bạn đã chặn ${data.blocked.username}`
              : "Đã chặn (người dùng không đăng ký)"
          )
        )
        .catch((error) =>
          toast.error(extractError(error, "Không thể chặn, vui lòng thử lại"))
        );
    });
  };

  const handleUnblock = () => {
    startTransition(() => {
      onUnblock(userId)
        .then((data) => toast.success(`Đã bỏ chặn ${data.blocked.username}`))
        .catch((error) =>
          toast.error(extractError(error, "Không thể bỏ chặn, vui lòng thử lại"))
        );
    });
  };

  const onClick = () => {
    if (isFollowing) {
      handleUnfollow();
    } else {
      handleFollow();
    }
  };

  return (
    <>
      <Button variant="primary" disabled={isPending} onClick={onClick}>
        {isFollowing ? "Bỏ theo dõi" : "Theo dõi"}
      </Button>
      <Button onClick={handleBlock} disabled={isPending}>
        Chặn
      </Button>
      <Button onClick={handleUnblock} disabled={isPending}>
        Bỏ chặn
      </Button>
    </>
  );
}
