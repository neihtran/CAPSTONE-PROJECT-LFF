import { NextResponse } from "next/server";

import { getSelf } from "@/lib/auth-service";
import {
  getOverviewStats,
  getDailyStats,
  getTopStreams,
  getRecentActivity,
} from "@/lib/analytics-service";

/**
 * GET /api/analytics/overview
 *    → tổng quan stats của streamer hiện tại.
 *    Query: ?days=30 (default 30).
 *
 * GET /api/analytics/daily?from=&to=
 *    → time-series stats.
 *
 * GET /api/analytics/top-streams?limit=10
 *    → top streams by views.
 *
 * GET /api/analytics/activity?limit=20
 *    → recent donations + subs.
 */
export async function GET(request: Request) {
  try {
    const self = await getSelf();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "overview";

    if (type === "overview") {
      const days = parseInt(searchParams.get("days") ?? "30", 10);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const stats = await getOverviewStats(self.id, since);

      return NextResponse.json({
        totalViews: stats.totalViews,
        totalUniqueViewers: stats.totalUniqueViewers,
        avgViewDurationSec: stats.avgViewDurationSec,
        totalStreamHours: stats.totalStreamHours,
        totalStreamSessions: stats.totalStreamSessions,
        avgPeakViewers: stats.avgPeakViewers,
        totalDonationCents: stats.totalDonationCents,
        totalSubscriptionCents: stats.totalSubscriptionCents,
        totalRevenueCents: stats.totalRevenueCents,
        totalActiveSubscribers: stats.totalActiveSubscribers,
        totalSubscribers: stats.totalSubscribers,
      });
    }

    if (type === "daily") {
      const fromStr = searchParams.get("from");
      const toStr = searchParams.get("to");
      const now = new Date();
      const from = fromStr ? new Date(fromStr) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const to = toStr ? new Date(toStr) : now;

      const daily = await getDailyStats(self.id, from, to);
      return NextResponse.json({ items: daily });
    }

    if (type === "top-streams") {
      const limit = parseInt(searchParams.get("limit") ?? "10", 10);
      const top = await getTopStreams(self.id, Math.min(50, Math.max(1, limit)));
      return NextResponse.json({
        items: top.map((s) => ({
          sessionId: s.sessionId,
          streamId: s.streamId,
          startedAt: s.startedAt.toISOString(),
          durationSec: s.durationSec,
          peakViewers: s.peakViewers,
          totalViews: s.totalViews,
          uniqueViewers: s.uniqueViewers,
          donationCents: s.donationCents,
        })),
      });
    }

    if (type === "activity") {
      const limit = parseInt(searchParams.get("limit") ?? "20", 10);
      const activity = await getRecentActivity(self.id, Math.min(50, Math.max(1, limit)));
      return NextResponse.json({
        items: activity.map((a) => ({
          type: a.type,
          createdAt: a.createdAt.toISOString(),
          ...a.data,
        })),
      });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/analytics] GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
