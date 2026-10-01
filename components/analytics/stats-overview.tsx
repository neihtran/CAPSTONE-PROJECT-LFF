"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";

type Overview = {
  totalViews: number;
  totalUniqueViewers: number;
  avgViewDurationSec: number;
  totalStreamHours: number;
  totalStreamSessions: number;
  avgPeakViewers: number;
  totalDonationCents: number;
  totalSubscriptionCents: number;
  totalRevenueCents: number;
  totalActiveSubscribers: number;
  totalSubscribers: number;
};

function fmtRevenue(vnd: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(vnd);
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDuration(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m`;
  return `${sec}s`;
}

const CARDS = [
  { key: "totalViews", label: "Tổng lượt xem", format: fmtNumber, color: "#9146FF" },
  { key: "totalStreamHours", label: "Giờ stream", format: (n: number) => `${n}h`, color: "#00C2A8" },
  { key: "avgPeakViewers", label: "Trung bình peak viewers", format: fmtNumber, color: "#FF6B6B" },
  { key: "totalActiveSubscribers", label: "Active subscribers", format: fmtNumber, color: "#FFD700" },
  { key: "totalRevenueCents", label: "Tổng thu nhập", format: fmtRevenue, color: "#32CD32" },
  { key: "totalDonationCents", label: "Từ Donation", format: fmtRevenue, color: "#FF8C00" },
  { key: "totalSubscriptionCents", label: "Từ Subscription", format: fmtRevenue, color: "#9146FF" },
  { key: "totalStreamSessions", label: "Số lần stream", format: fmtNumber, color: "#00BFFF" },
] as const;

export function StatsOverview({ overview }: { overview: Overview }) {
  const values = overview as unknown as Record<string, number>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {CARDS.map(({ key, label, format, color }) => {
        const value = values[key] ?? 0;
        return (
          <div
            key={key}
            className="rounded-xl border p-4 space-y-1"
            style={{ borderColor: `${color}30` }}
          >
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold" style={{ color }}>
              {format(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
