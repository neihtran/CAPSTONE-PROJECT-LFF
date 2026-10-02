/**
 * AnalyticsService — thống kê stream cho streamer dashboard.
 *
 * Tổng hợp data từ:
 *   - StreamSession: duration, peak viewers, total views, unique viewers.
 *   - StreamView: per-viewer view logs.
 *   - Donation: tổng tips.
 *   - Subscription: tổng subs + revenue.
 *
 * Các loại analytics:
 *   1. Overview stats: today's / this week's / this month's.
 *   2. Time-series: daily/weekly/monthly aggregation.
 *   3. Top streams: streams có view nhiều nhất.
 *   4. Audience: unique viewers, follower growth.
 */

import { db } from "@/lib/db";
import { subDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export type OverviewStats = {
  // Views.
  totalViews: number;
  totalUniqueViewers: number;
  avgViewDurationSec: number;
  // Sessions.
  totalStreamHours: number;
  totalStreamSessions: number;
  avgPeakViewers: number;
  // Revenue.
  totalDonationCents: number;
  totalSubscriptionCents: number;
  totalRevenueCents: number;
  // Subs.
  totalActiveSubscribers: number;
  totalSubscribers: number;
};

export type DailyStat = {
  date: string; // "YYYY-MM-DD"
  views: number;
  streamMinutes: number;
  peakViewers: number;
  uniqueViewers: number;
  donationCents: number;
  newSubscribers: number;
};

export type TopStreamStat = {
  sessionId: string;
  streamId: string;
  startedAt: Date;
  durationSec: number | null;
  peakViewers: number;
  totalViews: number;
  uniqueViewers: number;
  donationCents: number;
};

// ──────────────────────────────────────────────────────────────────────────
// OVERVIEW
// ──────────────────────────────────────────────────────────────────────────

/**
 * Tổng quan stats của 1 streamer.
 *
 * Logic đếm subscriber:
 *   - `totalActiveSubscribers`: đếm DISTINCT subscriberId (1 user sub nhiều tier
 *     hoặc upgrade tier nhiều lần → chỉ tính 1).
 *   - `totalSubscribers`: tổng row ACTIVE + EXPIRED + CANCELED (lịch sử sub).
 *
 * @param streamerId - UUID của streamer.
 * @param since - Lọc session từ thời điểm này (default: 30 ngày trước).
 */
export const getOverviewStats = async (
  streamerId: string,
  since?: Date
): Promise<OverviewStats> => {
  const startDate = since ?? subDays(new Date(), 30);

  const sessions = await db.streamSession.findMany({
    where: {
      stream: { userId: streamerId },
      startedAt: { gte: startDate },
    },
  });

  // Đếm DISTINCT subscriberId để tránh đếm trùng khi user upgrade tier nhiều lần.
  // Group-by cho unique count, không phụ thuộc vào DB constraint.
  const [subsAgg, donAgg, activeSubGroups, totalSubCount] = await Promise.all([
    db.subscription.aggregate({
      where: { streamerId, status: { in: ["ACTIVE", "EXPIRED", "CANCELED"] } },
      _sum: { totalCentsPaid: true },
    }),
    db.donation.aggregate({
      where: { recipientId: streamerId, status: "COMPLETED" },
      _sum: { amountCents: true },
    }),
    db.subscription.groupBy({
      by: ["subscriberId"],
      where: { streamerId, status: "ACTIVE" },
    }),
    db.subscription.count({
      where: { streamerId },
    }),
  ]);

  const totalViews = sessions.reduce((acc, s) => acc + s.totalViews, 0);
  const totalUnique = sessions.reduce((acc, s) => acc + s.uniqueViewers, 0);
  const totalDurationSec = sessions.reduce(
    (acc, s) => acc + (s.durationSec ?? 0),
    0
  );
  const avgPeak = sessions.length
    ? Math.round(sessions.reduce((acc, s) => acc + s.peakViewers, 0) / sessions.length)
    : 0;

  const totalDonations = donAgg._sum.amountCents ?? 0;
  const totalSubs = subsAgg._sum.totalCentsPaid ?? 0;

  return {
    totalViews,
    totalUniqueViewers: totalUnique,
    avgViewDurationSec: totalViews > 0 ? Math.round(totalDurationSec / totalViews) : 0,
    totalStreamHours: Math.round(totalDurationSec / 3600),
    totalStreamSessions: sessions.length,
    avgPeakViewers: avgPeak,
    totalDonationCents: totalDonations,
    totalSubscriptionCents: totalSubs,
    totalRevenueCents: totalDonations + totalSubs,
    totalActiveSubscribers: activeSubGroups.length,
    totalSubscribers: totalSubCount,
  };
};

// ──────────────────────────────────────────────────────────────────────────
// TIME-SERIES
// ──────────────────────────────────────────────────────────────────────────

/**
 * Stats theo ngày trong khoảng from → to.
 * Dùng cho chart trên analytics dashboard.
 *
 * Group theo UTC date (YYYY-MM-DD) để tránh lệch timezone.
 * Nếu 1 ngày không có session → không trả về row (chart tự gap).
 */
export const getDailyStats = async (
  streamerId: string,
  from: Date,
  to: Date
): Promise<DailyStat[]> => {
  const sessions = await db.streamSession.findMany({
    where: {
      stream: { userId: streamerId },
      startedAt: { gte: from, lte: to },
    },
    orderBy: { startedAt: "asc" },
  });

  console.log(
    `[Analytics] getDailyStats: streamer=${streamerId} range=[${from.toISOString()} → ${to.toISOString()}] sessions=${sessions.length}`
  );

  // Group by UTC date (YYYY-MM-DD).
  const byDay = new Map<string, DailyStat>();

  for (const s of sessions) {
    const key = s.startedAt.toISOString().slice(0, 10);
    if (!byDay.has(key)) {
      byDay.set(key, {
        date: key,
        views: 0,
        streamMinutes: 0,
        peakViewers: 0,
        uniqueViewers: 0,
        donationCents: 0,
        newSubscribers: 0,
      });
    }
    const day = byDay.get(key)!;
    day.views += s.totalViews;
    day.streamMinutes += Math.round((s.durationSec ?? 0) / 60);
    day.peakViewers = Math.max(day.peakViewers, s.peakViewers);
    day.uniqueViewers += s.uniqueViewers;
    day.donationCents += s.donationCents;
    day.newSubscribers += s.newSubscribers;
  }

  const result = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  console.log(`[Analytics] getDailyStats: grouped into ${result.length} days`);
  return result;
};

// ──────────────────────────────────────────────────────────────────────────
// TOP STREAMS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Top streams của streamer (theo views).
 */
export const getTopStreams = async (
  streamerId: string,
  limit = 10
): Promise<TopStreamStat[]> => {
  const sessions = await db.streamSession.findMany({
    where: { stream: { userId: streamerId } },
    orderBy: { totalViews: "desc" },
    take: limit,
  });

  return sessions.map((s) => ({
    sessionId: s.id,
    streamId: s.streamId,
    startedAt: s.startedAt,
    durationSec: s.durationSec,
    peakViewers: s.peakViewers,
    totalViews: s.totalViews,
    uniqueViewers: s.uniqueViewers,
    donationCents: s.donationCents,
  }));
};

// ──────────────────────────────────────────────────────────────────────────
// RECENT ACTIVITY
// ──────────────────────────────────────────────────────────────────────────

/**
 * Recent donations + subs cho activity feed.
 */
export const getRecentActivity = async (
  streamerId: string,
  limit = 20
): Promise<
  Array<
    | { type: "DONATION"; createdAt: Date; data: { amountCents: number; donorName: string; message: string | null } }
    | { type: "SUBSCRIPTION"; createdAt: Date; data: { tierName: string; subscriberName: string } }
  >
> => {
  const [recentDonations, recentSubs] = await Promise.all([
    db.donation.findMany({
      where: { recipientId: streamerId, status: "COMPLETED" },
      include: { donor: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.subscription.findMany({
      where: { streamerId, status: { in: ["ACTIVE", "CANCELED"] } },
      include: {
        subscriber: { select: { username: true } },
        tier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const activities: Array<
    | { type: "DONATION"; createdAt: Date; data: { amountCents: number; donorName: string; message: string | null } }
    | { type: "SUBSCRIPTION"; createdAt: Date; data: { tierName: string; subscriberName: string } }
  > = [];

  for (const d of recentDonations) {
    activities.push({
      type: "DONATION",
      createdAt: d.createdAt,
      data: {
        amountCents: d.amountCents,
        donorName: d.donor?.username ?? "Anonymous",
        message: d.message,
      },
    });
  }

  for (const s of recentSubs) {
    activities.push({
      type: "SUBSCRIPTION",
      createdAt: s.createdAt,
      data: {
        tierName: s.tier.name,
        subscriberName: s.subscriber.username,
      },
    });
  }

  // Merge sort by date desc.
  activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return activities.slice(0, limit);
};

// ──────────────────────────────────────────────────────────────────────────
// SESSION MANAGEMENT (internal — called by LiveKit webhook)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Tạo session mới khi streamer go live.
 */
export const startStreamSession = async (streamId: string) => {
  return db.streamSession.create({
    data: { streamId },
  });
};

/**
 * Cập nhật session stats khi stream end.
 *
 * Logic chống overwrite:
 *   - Nếu session đã có stats (đã update trước đó) → bỏ qua.
 *   - Nếu stats truyền vào toàn 0 (vd: webhook LiveKit) → tính lại từ DB.
 *
 * @param sessionId - UUID của StreamSession.
 * @param stats - Stats từ caller. Nếu totalViews=0 và donationCents=0 → tự tính lại.
 * @param options.force - Bỏ qua check, luôn update (dùng cho manual end action).
 */
export const endStreamSession = async (
  sessionId: string,
  stats: {
    peakViewers: number;
    totalViews: number;
    uniqueViewers: number;
    donationCents: number;
    newSubscribers: number;
  },
  options?: { force?: boolean }
) => {
  const session = await db.streamSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    console.warn(`[Analytics] endStreamSession: session ${sessionId} not found`);
    return;
  }

  const durationSec = session.startedAt
    ? Math.round((Date.now() - session.startedAt.getTime()) / 1000)
    : 0;

  // Nếu session đã có stats > 0 (đã end trước đó) và không force → bỏ qua
  // tránh webhook LiveKit ghi đè stats tốt từ manual end action.
  const alreadyHasStats =
    (session.peakViewers ?? 0) > 0 ||
    (session.totalViews ?? 0) > 0 ||
    (session.donationCents ?? 0) > 0;

  if (alreadyHasStats && !options?.force) {
    console.log(
      `[Analytics] endStreamSession: session ${sessionId} already has stats, skipping (use force=true to override)`
    );
    // Vẫn set endedAt + durationSec nếu chưa có.
    if (!session.endedAt) {
      return db.streamSession.update({
        where: { id: sessionId },
        data: { endedAt: new Date(), durationSec },
      });
    }
    return;
  }

  // Nếu caller truyền toàn 0 (vd: webhook ingress_ended) → tự tính lại từ DB.
  const allZero =
    stats.peakViewers === 0 &&
    stats.totalViews === 0 &&
    stats.uniqueViewers === 0 &&
    stats.donationCents === 0 &&
    stats.newSubscribers === 0;

  let finalStats = stats;
  if (allZero && !options?.force) {
    console.log(
      `[Analytics] endStreamSession: caller passed all-zero stats for ${sessionId}, recomputing from DB`
    );
    finalStats = await computeSessionStatsFromDb(sessionId, session.startedAt, session.streamId);
  }

  return db.streamSession.update({
    where: { id: sessionId },
    data: {
      endedAt: new Date(),
      durationSec,
      ...finalStats,
    },
  });
};

/**
 * Helper: tính session stats từ DB (dùng khi caller truyền stats=0).
 * Tương tự logic trong actions/stream.ts endStream() để fix Bug 3:
 * đảm bảo webhook LiveKit cũng tính đúng stats.
 */
async function computeSessionStatsFromDb(
  sessionId: string,
  startedAt: Date,
  streamId: string
): Promise<{
  peakViewers: number;
  totalViews: number;
  uniqueViewers: number;
  donationCents: number;
  newSubscribers: number;
}> {
  const stream = await db.stream.findUnique({
    where: { id: streamId },
    select: { userId: true },
  });
  if (!stream) {
    return { peakViewers: 0, totalViews: 0, uniqueViewers: 0, donationCents: 0, newSubscribers: 0 };
  }

  const [viewAgg, uniqueUserCount, donationAgg, newSubsCount] = await Promise.all([
    db.streamView.count({ where: { sessionId } }),
    db.streamView.findMany({
      where: { sessionId, userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    db.donation.aggregate({
      where: { streamId, status: "COMPLETED", createdAt: { gte: startedAt } },
      _sum: { amountCents: true },
    }),
    db.subscription.count({
      where: { streamerId: stream.userId, startedAt: { gte: startedAt } },
    }),
  ]);

  const totalViews = viewAgg;
  const uniqueViewers = uniqueUserCount.length;
  const peakViewers = Math.max(totalViews, uniqueViewers);

  return {
    peakViewers,
    totalViews,
    uniqueViewers,
    donationCents: donationAgg._sum.amountCents ?? 0,
    newSubscribers: newSubsCount,
  };
}

/**
 * Log 1 viewer join.
 */
export const logViewerJoin = async (params: {
  sessionId: string;
  userId?: string | null;
}) => {
  return db.streamView.create({
    data: {
      sessionId: params.sessionId,
      userId: params.userId ?? null,
    },
  });
};

/**
 * Log viewer leave (update duration).
 */
export const logViewerLeave = async (params: {
  sessionId: string;
  userId: string;
}) => {
  const view = await db.streamView.findFirst({
    where: { sessionId: params.sessionId, userId: params.userId },
    orderBy: { joinedAt: "desc" },
  });

  if (!view) return;

  const durationSec = view.joinedAt
    ? Math.round((Date.now() - view.joinedAt.getTime()) / 1000)
    : 0;

  await db.streamView.update({
    where: { id: view.id },
    data: { leftAt: new Date(), durationSec },
  });
};
