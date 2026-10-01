"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";

type Notification = {
  id: string;
  type: string;
  status: string;
  title: string;
  body: string;
  linkUrl: string | null;
  createdAt: string;
  readAt: string | null;
  actor: { id: string; username: string; imageUrl: string } | null;
};

/**
 * NotificationBell — icon chuông + badge số UNREAD + dropdown.
 *
 * Auto-connect SSE khi mount → nhận real-time notification.
 * Click bell → toggle dropdown.
 * Click notification → navigate tới linkUrl + mark read.
 * "Mark all read" → PATCH all.
 */
export function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount.
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?count=true");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      }
    } catch (err) {
      console.warn("[NotificationBell] fetch count failed:", err);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (err) {
      console.warn("[NotificationBell] fetch items failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // SSE subscription.
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = () => {
      eventSource = new EventSource("/api/realtime/notifications");

      eventSource.addEventListener("notification", (e) => {
        try {
          const payload = JSON.parse((e as MessageEvent).data);
          // Update unread count.
          setUnreadCount((c) => c + 1);
          // Toast for visibility.
          toast(payload.title, {
            description: payload.body,
            action: payload.linkUrl
              ? {
                  label: "Xem",
                  onClick: () => router.push(payload.linkUrl),
                }
              : undefined,
          });
        } catch (err) {
          console.warn("[NotificationBell] parse SSE payload:", err);
        }
      });

      eventSource.onerror = () => {
        // Auto-reconnect sau 3s.
        eventSource?.close();
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
    };
  }, [router]);

  // Initial fetch.
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Fetch items khi mở dropdown.
  useEffect(() => {
    if (isOpen) fetchItems();
  }, [isOpen, fetchItems]);

  // Click outside → close.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (n: Notification) => {
    if (n.status === "UNREAD") {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: n.id }),
        });
        // Optimistic update.
        setItems((prev) =>
          prev.map((it) =>
            it.id === n.id
              ? { ...it, status: "READ", readAt: new Date().toISOString() }
              : it
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.warn("[NotificationBell] mark read failed:", err);
      }
    }
    if (n.linkUrl) {
      router.push(n.linkUrl);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          status: "READ",
          readAt: it.readAt ?? new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
      toast.success("Đã đánh dấu tất cả là đã đọc");
    } catch {
      toast.error("Không thể đánh dấu đã đọc");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[70vh] bg-card border rounded-xl shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold">Thông báo</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Đánh dấu tất cả đã đọc
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push("/notifications");
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Xem tất cả →
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Đang tải...
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Chưa có thông báo nào.
              </div>
            ) : (
              items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClick={() => handleMarkRead(n)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification: n,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const isUnread = n.status === "UNREAD";

  const typeIcon: Record<string, string> = {
    FOLLOW: "👤",
    LIVE: "🔴",
    CLIP: "✂️",
    MODERATION: "⚠️",
    SYSTEM: "📢",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full text-left items-start gap-x-3 p-3 border-b hover:bg-muted/50 transition-colors",
        isUnread && "bg-primary/5"
      )}
    >
      {n.actor ? (
        <UserAvatar
          username={n.actor.username}
          imageUrl={n.actor.imageUrl}
          isLive={false}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">
          {typeIcon[n.type] ?? "📬"}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-x-2">
          <p className="text-sm font-semibold">{n.title}</p>
          {isUnread && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{n.body}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}
