"use client";

import React, { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  banUserAction,
  deleteMessageAction,
} from "@/actions/moderation";

type ChatMessageContextMenuProps = {
  messageId: string | null; // null = live message, chưa có DB id
  targetUserId: string;
  targetUsername: string;
  streamId: string | null;
  isMod: boolean;
  isLive: boolean;
  reporterUserId: string | null;
  onClose: () => void;
  onTimeout: () => void;
  menuSide?: "bottom" | "top"; // auto-detected: flip up if near bottom
};

/**
 * Context menu popover cho 1 chat message.
 *
 * Moderator/Owner: thấy Timeout / Ban / Delete Message.
 * Viewer (không phải mod): thấy Report.
 * Chính mình: không thấy gì.
 */
export function ChatMessageContextMenu({
  messageId,
  targetUserId,
  targetUsername,
  streamId,
  isMod,
  isLive,
  reporterUserId,
  onClose,
  onTimeout,
  menuSide = "bottom",
}: ChatMessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Click outside → close.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleBan = () => {
    if (!streamId) return;
    startTransition(async () => {
      try {
        await banUserAction({
          streamId,
          targetUserId,
          reason: "Vi phạm quy định chat",
        });
        toast.success(`Đã ban @${targetUsername}`);
        onClose();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Không thể ban user"
        );
      }
    });
  };

  const handleDelete = () => {
    if (!streamId || !messageId) {
      toast.warning("Tin nhắn live không thể xóa trực tiếp. Đợi nó được lưu vào DB.");
      return;
    }
    startTransition(async () => {
      try {
        await deleteMessageAction({
          streamId,
          messageId,
          reason: "Vi phạm quy định chat",
        });
        toast.success("Đã xóa tin nhắn");
        onClose();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Không thể xóa tin nhắn"
        );
      }
    });
  };

  const handleReport = async () => {
    if (!reporterUserId) {
      toast.error("Bạn cần đăng nhập để báo cáo");
      return;
    }
    if (!streamId || !messageId) {
      toast.warning("Tin nhắn live chưa có trong hệ thống. Đợi nó được lưu.");
      return;
    }

    const reason = window.prompt(
      `Báo cáo @${targetUsername} — nhập lý do (tùy chọn):`
    );
    // null = user cancel prompt
    if (reason === undefined) return;

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          messageId,
          reportedUserId: targetUserId,
          reason,
        }),
      });

      if (res.ok) {
        toast.success("Đã gửi báo cáo. Cảm ơn bạn!");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Không thể gửi báo cáo");
      }
    } catch {
      toast.error("Lỗi mạng");
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className={cn(
        "absolute right-2 z-50",
        "min-w-40 bg-card border border-border rounded-lg shadow-lg",
        "p-1 space-y-0.5 animate-in fade-in-0 zoom-in-95 duration-100",
        menuSide === "top"
          ? "bottom-full mb-1"
          : "top-full mt-1"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {isMod ? (
        <>
          {/* Timeout */}
          <MenuButton onClick={onTimeout} disabled={isPending}>
            ⏱ Timeout
          </MenuButton>

          {/* Ban */}
          <MenuButton
            onClick={handleBan}
            disabled={isPending}
            variant="danger"
          >
            🚫 Ban vĩnh viễn
          </MenuButton>

          {/* Delete */}
          <MenuButton
            onClick={handleDelete}
            disabled={isPending}
            variant="danger"
          >
            🗑 Xóa tin nhắn
          </MenuButton>
        </>
      ) : reporterUserId ? (
        <>
          {/* Report (viewer) */}
          <MenuButton onClick={handleReport}>
            🚩 Báo cáo vi phạm
          </MenuButton>
        </>
      ) : null}
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full text-left px-3 py-2 rounded text-sm transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "danger"
          ? "text-red-400 hover:bg-red-500/10"
          : "text-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}
