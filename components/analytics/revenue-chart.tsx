"use client";

import React, { useState } from "react";

type DailyStat = {
  date: string;
  views: number;
  streamMinutes: number;
  peakViewers: number;
  uniqueViewers: number;
  donationCents: number;
  newSubscribers: number;
};

type DailyStatDisplay = {
  date: string;
  views: number;
  streamMinutes: number;
  peakViewers: number;
  donationCents: number;
  subscriptionRevenue: number;
};

const CHART_COLS = [
  { key: "views", label: "Lượt xem", color: "#9146FF" },
  { key: "peakViewers", label: "Peak viewers", color: "#FF6B6B" },
  { key: "donationCents", label: "Donation ($)", color: "#FF8C00" },
  { key: "subscriptionRevenue", label: "Sub revenue ($)", color: "#00C2A8" },
] as const;

/**
 * RevenueChart — simple bar chart dùng pure HTML/CSS + SVG (không cần thư viện nặng).
 *
 * MVP: hiển thị bar chart đơn giản. Production: thay bằng recharts nếu cần.
 */
export function RevenueChart({ dailyStats }: { dailyStats: DailyStat[] }) {
  const [activeMetric, setActiveMetric] = useState<"views" | "peakViewers" | "donationCents">("views");

  if (!dailyStats || dailyStats.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center text-muted-foreground">
        Chưa có dữ liệu. Bắt đầu stream để thu thập analytics.
      </div>
    );
  }

  // Flatten subscription revenue = 0 for now (no per-day sub tracking in MVP).
  const display: DailyStatDisplay[] = dailyStats.map((s) => ({
    date: s.date,
    views: s.views,
    streamMinutes: s.streamMinutes,
    peakViewers: s.peakViewers,
    donationCents: s.donationCents,
    subscriptionRevenue: 0,
  }));

  const maxVal = Math.max(...display.map((d) => d[activeMetric] ?? 1), 1);

  const latest = display[display.length - 1];
  const prev = display.length >= 2 ? display[display.length - 2] : null;

  const change = prev
    ? (((latest?.[activeMetric] ?? 0) - (prev?.[activeMetric] ?? 0)) / Math.max(prev?.[activeMetric] ?? 1, 1)) * 100
    : null;

  return (
    <div className="rounded-xl border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Thống kê theo ngày</h3>
        <div className="flex gap-1">
          {(["views", "peakViewers", "donationCents"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMetric(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeMetric === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {m === "views" ? "Views" : m === "peakViewers" ? "Peak" : "Donation"}
            </button>
          ))}
        </div>
      </div>

      {/* Latest stat */}
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold">
          {activeMetric === "donationCents"
            ? new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
                maximumFractionDigits: 0,
              }).format(latest?.[activeMetric] ?? 0)
            : (latest?.[activeMetric] ?? 0).toLocaleString()}
        </span>
        {change !== null && (
          <span
            className={`text-sm font-medium ${
              change >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
          </span>
        )}
        <span className="text-sm text-muted-foreground">hôm qua</span>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1 h-40">
        {display.slice(-14).map((day, i) => {
          const val = day[activeMetric] ?? 0;
          const heightPct = (val / maxVal) * 100;
          const isLast = i === display.slice(-14).length - 1;
          const col = CHART_COLS.find((c) => c.key === activeMetric);

          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1 group"
              title={`${day.date}: ${val.toLocaleString()}`}
            >
              <div className="w-full flex items-end justify-center h-full">
                <div
                  className="w-full rounded-t-sm transition-all hover:opacity-80 min-h-[2px]"
                  style={{
                    height: `${Math.max(heightPct, 2)}%`,
                    backgroundColor: col?.color ?? "#9146FF",
                    opacity: isLast ? 1 : 0.6,
                  }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground rotate-45 origin-left mt-2 hidden group-hover:block">
                {day.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
