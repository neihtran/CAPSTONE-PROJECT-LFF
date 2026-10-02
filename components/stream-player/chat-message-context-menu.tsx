"use client";

import React, { useEffect, useRef, useTransition } from "react";
import { createPortal } from "react-dom";
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
  /**
   * Anchor element để tính vị trí popover (message row).
   * Bắt buộc khi dùng Portal — menu thoát khỏi overflow container nên
   * cần tính toán vị trí fixed dựa trên rect của anchor.
   */
  anchorRef: React.RefObject<HTMLElement>;
  /** Auto-detected: flip up if near bottom. */
  menuSide?: "bottom" | "top";
};

/**
 * Context menu popover cho 1 chat message.
 *
 * Moderator/Owner: thấy Timeout / Ban / Delete Message.
 * Viewer (không phải mod): thấy Report.
 * Chính mình: không thấy gì.
 *
 * Fix bug "menu rơi xuống dưới khung chat":
 *   Render qua React Portal vào document.body + dùng position: fixed
 *   với toạ độ từ anchorRef.getBoundingClientRect().
 *   Trước đây menu dùng absolute + anchor là div nhỏ + ChatList có
 *   overflow-y-auto → menu bị cắt, hiển thị như rớt ra ngoài khung.
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
  anchorRef,
  menuSide = "bottom",
}: ChatMessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Position: tính theo rect của anchor + re-position khi scroll/resize.
  // Dùng inline style position: fixed → không bị clipping bởi overflow parent.
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null
  );

  useEffect(() => {
    const updatePos = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      // Ước lượng width menu để canh right; nếu menu đã mount thì lấy width thật.
      const menuWidth = menu?.offsetWidth ?? 160;
      const top =
        menuSide === "top"
          ? rect.top - 8 // mở lên trên (offsetHeight sẽ làm top dưới nếu cần)
          : rect.bottom + 4;
      const left = Math.max(8, rect.right - menuWidth);
      setPos({ top, left });
    };

    updatePos();

    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [anchorRef, menuSide]);

  // Click outside → close.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        // Bỏ qua click trên anchor (để toggle menu, không đóng ngay)
        if (anchorRef.current && anchorRef.current.contains(target)) return;
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, anchorRef]);

  // Esc → close.
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
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

  // Render qua Portal — thoát khỏi mọi overflow container (ChatList).
  if (typeof window === "undefined") return null;

  const menuNode = (
    <div
      ref={menuRef}
      // position: fixed → không bị clip bởi overflow-y-auto của ChatList.
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 50,
      }}
      className={cn(
        "min-w-40 bg-card border border-border rounded-lg shadow-lg",
        "p-1 space-y-0.5 animate-in fade-in-0 zoom-in-95 duration-100"
      )}
      // menuSide chỉ dùng cho logic tính pos ở useEffect, không cần class.
      data-menu-side={menuSide}
      onClick={(e) => e.stopPropagation()}
    >
      {isMod ? (
        <>
          {/* Timeout */}
          <MenuButton onClick={onTimeout} disabled={isPending}>
            ⏱ Timeout
          </MenuButton>

          {/* Ban */}
          <MenuButton onClick={handleBan} disabled={isPending} variant="danger">
            🚫 Ban vĩnh viễn
          </MenuButton>

          {/* Delete */}
          <MenuButton onClick={handleDelete} disabled={isPending} variant="danger">
            🗑 Xóa tin nhắn
          </MenuButton>
        </>
      ) : reporterUserId ? (
        <>
          {/* Report (viewer) */}
          <MenuButton onClick={handleReport}>🚩 Báo cáo vi phạm</MenuButton>
        </>
      ) : null}
    </div>
  );

  return createPortal(menuNode, document.body);
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
