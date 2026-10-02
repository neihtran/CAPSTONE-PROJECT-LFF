"use client";

/**
 * RevenueChart — bar chart thống kê theo ngày.
 *
 * MVP: dùng pure HTML/CSS + flexbox (không cần thư viện nặng).
 *
 * Fix Bug 2:
 *   - Nếu prev = 0 → hiển thị "Mới" (không phải "↑ 100%").
 *   - Nếu maxVal = 0 (toàn bộ data = 0) → empty state đẹp.
 *   - Nếu CHỈ có 1 ngày data → vẫn hiển thị bar (prev = null → change = null).
 *   - Label ngày hiển thị dưới mỗi bar (không chỉ khi hover).
 *   - Tooltip khi hover bar (dùng title attribute + UI tooltip dưới bar).
 *   - Tăng độ tương phản giữa active bar (full opacity) và bars khác (0.5).
 *   - Min-height 4% thay vì 2% để bars nhỏ vẫn nhìn thấy.
 */

import React, { useState } from "react";
import { TrendingDown, TrendingUp, Minus, BarChart3 } from "lucide-react";

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
  { key: "views" as const, label: "Lượt xem", color: "#9146FF", shortLabel: "Views" },
  { key: "peakViewers" as const, label: "Lượt xem cao nhất", color: "#FF6B6B", shortLabel: "Peak" },
  { key: "donationCents" as const, label: "Tiền quyên góp (VNĐ)", color: "#FF8C00", shortLabel: "Donate" },
] as const;

type MetricKey = (typeof CHART_COLS)[number]["key"];

const VND_FORMAT = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

/**
 * Format value theo metric.
 */
function formatValue(metric: MetricKey, value: number): string {
  if (metric === "donationCents") return VND_FORMAT.format(value);
  return value.toLocaleString("vi-VN");
}

/**
 * Format date ngắn để hiển thị dưới bar (vd: "09/26").
 */
function formatShortDate(date: string): string {
  // date là YYYY-MM-DD → lấy MM/DD.
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${parts[1]}/${parts[2]}`;
}

export function RevenueChart({ dailyStats }: { dailyStats: DailyStat[] }) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("views");

  // Empty state: không có data.
  if (!dailyStats || dailyStats.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center space-y-2">
        <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Chưa có dữ liệu. Bắt đầu stream để thu thập thống kê.
        </p>
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

  // Tính maxVal từ data thật (không default 1).
  const allValues = display.map((d) => d[activeMetric] ?? 0);
  const maxVal = Math.max(...allValues, 0);
  const hasData = maxVal > 0;

  const latest = display[display.length - 1];
  const prev = display.length >= 2 ? display[display.length - 2] : null;

  // Fix Bug 2: nếu prev = 0 → change = null (không hiển thị "↑ 100%").
  let change: number | null = null;
  if (prev) {
    const prevVal = prev[activeMetric] ?? 0;
    const latestVal = latest[activeMetric] ?? 0;
    if (prevVal > 0) {
      change = ((latestVal - prevVal) / prevVal) * 100;
    } else if (latestVal > 0) {
      // prev = 0 nhưng latest > 0 → không có % hợp lệ, đánh dấu "Mới".
      change = null;
    }
  }

  const latestValue = latest[activeMetric] ?? 0;

  return (
    <div className="rounded-xl border p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Thống kê theo ngày</h3>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {CHART_COLS.map((col) => (
            <button
              key={col.key}
              type="button"
              onClick={() => setActiveMetric(col.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeMetric === col.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={activeMetric === col.key ? { color: col.color } : undefined}
            >
              {col.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Latest value + change */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold tabular-nums">
          {formatValue(activeMetric, latestValue)}
        </span>
        {change !== null ? (
          <span
            className={`text-sm font-medium inline-flex items-center gap-0.5 ${
              change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "text-muted-foreground"
            }`}
          >
            {change > 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : change < 0 ? (
              <TrendingDown className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
            {change > 0 ? "+" : ""}
            {change.toFixed(1)}%
          </span>
        ) : prev && latestValue > 0 ? (
          // prev = 0, latest > 0 → hiển thị "Mới"
          <span className="text-sm font-medium text-blue-500">Mới</span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {prev ? "so với hôm qua" : "hôm nay"}
        </span>
      </div>

      {/* Bar chart hoặc empty state */}
      {hasData ? (
        <div>
          <div className="flex items-end gap-1.5 h-44 px-2">
            {display.slice(-14).map((day, i, arr) => {
              const val = day[activeMetric] ?? 0;
              // Min height 4% để bar nhỏ vẫn nhìn thấy, max 100%.
              const heightPct = maxVal > 0 ? Math.max((val / maxVal) * 100, val > 0 ? 4 : 0) : 0;
              const isLast = i === arr.length - 1;
              const col = CHART_COLS.find((c) => c.key === activeMetric);

              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-stretch justify-end h-full group cursor-pointer"
                  title={`${day.date}: ${formatValue(activeMetric, val)}`}
                >
                  {/* Tooltip khi hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -translate-y-8 px-2 py-1 rounded bg-popover text-popover-foreground text-[10px] font-medium border shadow-md whitespace-nowrap pointer-events-none z-10">
                    {formatValue(activeMetric, val)}
                  </div>

                  {/* Bar */}
                  <div
                    className="w-full rounded-t-md transition-all duration-300"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: col?.color ?? "#9146FF",
                      opacity: isLast ? 1 : val > 0 ? 0.5 : 0.2,
                      minHeight: val > 0 ? "4px" : "0px",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Date labels */}
          <div className="flex items-center gap-1.5 px-2 mt-2">
            {display.slice(-14).map((day, i, arr) => {
              const isLast = i === arr.length - 1;
              return (
                <div key={`label-${day.date}`} className="flex-1 text-center">
                  <span
                    className={`text-[10px] ${
                      isLast ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {formatShortDate(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Empty state khi maxVal = 0
        <div className="h-44 flex items-center justify-center rounded-lg bg-muted/30 border border-dashed">
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              Chưa có dữ liệu {CHART_COLS.find((c) => c.key === activeMetric)?.label.toLowerCase()}
            </p>
            <p className="text-xs text-muted-foreground">
              Metric này sẽ cập nhật sau khi có stream tiếp theo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
