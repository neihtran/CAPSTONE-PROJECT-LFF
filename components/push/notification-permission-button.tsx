"use client";

import React, { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";

import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pwa-client";

/**
 * NotificationPermissionButton — request + subscribe to push.
 *
 * State machine:
 *   - default: chưa có quyền → show "Bật thông báo"
 *   - granted: đã bật → show "Tắt thông báo"
 *   - denied: đã từ chối → disable button
 *   - unsupported: browser không hỗ trợ
 */
export function NotificationPermissionButton({
  className = "",
}: {
  className?: string;
}) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | "loading">("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    // Check existing subscription.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      }).catch(() => {});
    }
  }, []);

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);

    try {
      // 1. Register service worker.
      await registerServiceWorker();

      // 2. Request permission.
      const result = await requestNotificationPermission();
      setPermission(result);

      if (result === "granted") {
        // 3. Subscribe to push.
        const sub = await subscribeToPush();
        setSubscribed(!!sub);
      }
    } catch (err) {
      console.error("[Notifications] Enable failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await unsubscribeFromPush();
      if (ok) setSubscribed(false);
    } catch (err) {
      console.error("[Notifications] Disable failed:", err);
    } finally {
      setBusy(false);
    }
  };

  if (permission === "unsupported") {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-muted-foreground ${className}`}>
        <BellOff className="w-4 h-4" />
        <span>Browser không hỗ trợ thông báo</span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/5 text-sm text-red-400 ${className}`}>
        <BellOff className="w-4 h-4" />
        <span>Thông báo đã bị chặn. Bật lại trong cài đặt browser.</span>
      </div>
    );
  }

  if (subscribed || permission === "granted") {
    return (
      <button
        type="button"
        onClick={handleDisable}
        disabled={busy}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-sm text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50 ${className}`}
      >
        <Bell className="w-4 h-4" />
        <span>{busy ? "Đang xử lý..." : "Đã bật thông báo"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleEnable}
      disabled={busy || permission === "loading"}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity disabled:opacity-50 ${className}`}
    >
      <Bell className="w-4 h-4" />
      <span>{busy ? "Đang bật..." : "Bật thông báo đẩy"}</span>
    </button>
  );
}
