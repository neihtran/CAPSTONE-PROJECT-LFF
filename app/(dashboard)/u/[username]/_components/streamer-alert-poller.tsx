"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { formatVND } from "@/lib/format";

/**
 * StreamerAlertPoller — fallback polling cho streamer dashboard.
 *
 * Khi streamer KHÔNG ở trong LiveKit room (vd: đang ở /keys, /analytics),
 * LiveKit Data Channel không hoạt động → dùng polling mỗi 5s.
 *
 * Trade-off vs LiveKit Data Channel:
 *   - Latency: 0-5s (vs <500ms real-time).
 *   - Infra: thêm 1 endpoint + interval fetch.
 *   - UX: vẫn đủ nhanh cho donate/subscribe notification.
 *
 * Cleanup: khi component unmount → clear interval.
 */
export function StreamerAlertPoller() {
  const lastSinceRef = useRef<number>(Date.now() - 60_000); // initial: -60s để bắt cũ
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      // Bỏ qua nếu tab đang ẩn (giảm tải server + tránh app "đứng" khi user
      // không nhìn vào tab).
      if (document.hidden) return;

      try {
        const since = lastSinceRef.current;
        const res = await fetch(`/api/alerts/recent?since=${since}`);
        if (!res.ok) return;
        const data = await res.json();
        const alerts = data.alerts as Array<{
          kind: "DONATION" | "SUBSCRIBE";
          timestamp: number;
          username: string;
          amountCents?: number;
          tierName?: string;
          message?: string;
        }>;

        for (const a of alerts) {
          if (a.kind === "DONATION") {
            const amount = formatVND(a.amountCents ?? 0);
            toast.success(
              `🎉 @${a.username} vừa donate ${amount}${
                a.message ? ` — "${a.message.slice(0, 50)}"` : ""
              }`,
              { duration: 6000 }
            );
          } else if (a.kind === "SUBSCRIBE") {
            toast.success(
              `⭐ @${a.username} vừa subscribe${a.tierName ? ` gói ${a.tierName}` : ""}`,
              { duration: 6000 }
            );
          }
        }

        // Cập nhật lastSince = max timestamp trong batch (hoặc serverTime nếu rỗng).
        if (alerts.length > 0) {
          lastSinceRef.current = Math.max(
            ...alerts.map((a) => a.timestamp),
            Date.now()
          );
        } else {
          lastSinceRef.current = data.serverTime ?? Date.now();
        }
      } catch (err) {
        console.warn("[StreamerAlertPoller] poll failed:", err);
      }
    };

    // Poll ngay 1 lần + interval 15s (tăng từ 5s → 15s để giảm tải
    // service worker cache + tránh "treo" khi server chậm).
    poll();
    intervalRef.current = setInterval(poll, 15_000);

    // Khi tab hiện lại → poll ngay để bắt alert bỏ lỡ.
    const onVisibility = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}