import React from "react";
import { redirect } from "next/navigation";
import { subDays } from "date-fns";

import { getSelfByUsername } from "@/lib/auth-service";
import { getOverviewStats, getDailyStats, getTopStreams } from "@/lib/analytics-service";
import { getStreamerSubscriptionRevenue } from "@/lib/subscription-service";
import { getStreamerDonationRevenue } from "@/lib/donation-service";
import { StatsOverview } from "@/components/analytics/stats-overview";
import { RevenueChart } from "@/components/analytics/revenue-chart";
import { TopStreamsTable } from "@/components/analytics/top-streams-table";

interface AnalyticsPageProps {
  params: { username: string };
}

/**
 * /u/[username]/analytics — Streamer analytics dashboard.
 *
 * Hiển thị:
 *   - Tổng quan: views, hours, peak viewers, subscribers, revenue.
 *   - Chart: revenue theo ngày.
 *   - Bảng: top streams.
 *
 * Chỉ chủ sở hữu (owner) mới xem được.
 */
export default async function AnalyticsPage({ params: { username } }: AnalyticsPageProps) {
  const self = await getSelfByUsername(username);
  if (!self) redirect("/");

  // Chỉ owner xem được analytics.
  if (!self.stream) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Bạn chưa có stream nào. Tạo stream để xem analytics.
      </div>
    );
  }

  // 30 ngày gần nhất (fix Bug 3: đảm bảo date range đúng để hiển thị lịch sử).
  // Tính từ đầu ngày hôm qua (00:00:00 UTC) → hiện tại để bao gồm cả session
  // stream vào ngày hôm qua và hôm nay.
  const since = subDays(new Date(), 30);
  const [overview, dailyStats, topStreams, subRevenue, donRevenue] = await Promise.all([
    getOverviewStats(self.id, since),
    getDailyStats(self.id, since, new Date()),
    getTopStreams(self.id, 10),
    getStreamerSubscriptionRevenue(self.id),
    getStreamerDonationRevenue(self.id),
  ]);

  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 lg:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Thống kê</h1>
        <p className="text-sm text-muted-foreground">
          Thống kê phát sóng của bạn (30 ngày gần nhất)
        </p>
      </div>

      <StatsOverview overview={overview} />

      <RevenueChart dailyStats={dailyStats} />

      <TopStreamsTable streams={topStreams} />
    </div>
  );
}
