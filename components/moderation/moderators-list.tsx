"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import {
  addModeratorAction,
  removeModeratorAction,
} from "@/actions/moderation";

type Moderator = {
  userId: string;
  username: string;
  imageUrl: string;
  bio: string | null;
  addedAt: string;
};

/**
 * ModeratorsList — Owner thêm/xóa moderator theo username.
 *
 * Add: nhập username (frontend không có user-search API → thử trực tiếp).
 * Remove: confirm dialog trước khi xóa.
 */
export function ModeratorsList({
  streamId,
  ownerUsername,
  isOwner,
  moderators,
}: {
  streamId: string;
  ownerUsername: string;
  isOwner: boolean;
  moderators: Moderator[];
}) {
  const [username, setUsername] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;

    startTransition(async () => {
      try {
        // Lookup userId bằng username.
        const res = await fetch(
          `/api/users/lookup?username=${encodeURIComponent(trimmed)}`
        );
        if (!res.ok) {
          toast.error("Không tìm thấy user");
          return;
        }
        const data = await res.json();

        await addModeratorAction({
          streamId,
          userId: data.id,
        });
        toast.success(`Đã thêm @${trimmed} làm moderator`);
        setUsername("");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Không thể thêm moderator"
        );
      }
    });
  };

  const handleRemove = (userId: string, modUsername: string) => {
    if (!confirm(`Xóa @${modUsername} khỏi danh sách moderator?`)) return;

    startTransition(async () => {
      try {
        await removeModeratorAction({ streamId, userId });
        toast.success(`Đã xóa @${modUsername}`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Không thể xóa moderator"
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Moderators</h3>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Moderator có quyền timeout và xóa messages, nhưng không có quyền ban."
            : "Danh sách moderators của stream này (chỉ owner mới có quyền thêm/xóa)."}
        </p>
      </div>

      {isOwner && (
        <form onSubmit={handleAdd} className="flex gap-x-2">
          <Input
            placeholder="Nhập username (vd: linhcode)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isPending}
          />
          <Button type="submit" disabled={isPending || !username.trim()}>
            {isPending ? "Đang thêm..." : "Thêm"}
          </Button>
        </form>
      )}

      <div className="space-y-2">
        {moderators.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Chưa có moderator nào.
          </p>
        ) : (
          moderators.map((mod) => (
            <div
              key={mod.userId}
              className="flex items-center gap-x-3 p-3 border rounded-md"
            >
              <UserAvatar
                username={mod.username}
                imageUrl={mod.imageUrl}
                isLive={false}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">@{mod.username}</p>
                {mod.bio && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {mod.bio}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Thêm {new Date(mod.addedAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(mod.userId, mod.username)}
                  disabled={isPending}
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                >
                  Xóa
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
