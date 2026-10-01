/**
 * recent-alerts-service.ts — fallback polling cho streamer notification.
 *
 * Khi streamer không ở trong LiveKit room (vd: đang ở trang `/keys`,
 * `/analytics`, hoặc chưa join room), LiveKit Data Channel không hoạt động.
 *
 * Fallback: poll recent donations + subscriptions (trong 60s gần nhất) →
 * cho phép streamer dashboard hiển thị toast thông qua interval fetch.
 *
 * Trade-off:
 *   - LiveKit Data Channel (default):
 *     + Real-time, sub-second latency.
 *     + Không thêm infra (đã có sẵn LiveKit Cloud).
 *     - Chỉ hoạt động khi streamer join room.
 *   - Polling (fallback):
 *     + Luôn hoạt động, dù streamer ở đâu.
 *     - Thêm 1 endpoint + interval fetch (5-10s).
 *     - Tốn 1 round-trip DB mỗi lần poll.
 */

import { db } from "@/lib/db";

/**
 * Lấy donations + subs xảy ra sau 1 timestamp (ms).
 * Streamer dashboard gọi mỗi 5s với `since = Date.now()` lần trước.
 *
 * Kết quả sort theo thời gian tạo ASC để toast hiển thị đúng thứ tự.
 */
export const getRecentAlerts = async (
  streamerId: string,
  sinceMs: number
) => {
  const since = new Date(sinceMs);

  // Promise.all: chạy 2 query song song.
  const [donations, subs] = await Promise.all([
    db.donation.findMany({
      where: {
        recipientId: streamerId,
        createdAt: { gt: since },
        status: "COMPLETED",
      },
      orderBy: { createdAt: "asc" },
      take: 10,
      include: {
        donor: { select: { username: true } },
      },
    }),
    db.subscription.findMany({
      where: {
        streamerId,
        createdAt: { gt: since },
        status: "ACTIVE",
      },
      orderBy: { createdAt: "asc" },
      take: 10,
      include: {
        subscriber: { select: { username: true } },
        tier: { select: { name: true } },
      },
    }),
  ]);

  // Merge thành unified alert format.
  const donationAlerts = donations.map((d) => ({
    kind: "DONATION" as const,
    timestamp: d.createdAt.getTime(),
    username: d.donor?.username ?? "Anonymous",
    amountCents: d.amountCents,
    message: d.message,
  }));

  const subAlerts = subs.map((s) => ({
    kind: "SUBSCRIBE" as const,
    timestamp: s.createdAt.getTime(),
    username: s.subscriber?.username ?? "Anonymous",
    tierName: s.tier?.name,
  }));

  return [...donationAlerts, ...subAlerts].sort(
    (a, b) => a.timestamp - b.timestamp
  );
};