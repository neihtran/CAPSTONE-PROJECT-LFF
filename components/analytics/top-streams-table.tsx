"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";

type TopStreamStat = {
  sessionId: string;
  streamId: string;
  startedAt: Date | string;
  durationSec: number | null;
  peakViewers: number;
  totalViews: number;
  uniqueViewers: number;
  donationCents: number;
};

function fmtCents(vnd: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(vnd);
}

function fmtDuration(sec: number | null): string {
  if (!sec) return "-";
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m`;
  return `${sec}s`;
}

export function TopStreamsTable({ streams }: { streams: TopStreamStat[] }) {
  if (!streams || streams.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center text-muted-foreground">
        Chưa có dữ liệu stream.
      </div>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h3 className="font-semibold">Top Streams</h3>
        <p className="text-sm text-muted-foreground">Các stream có lượng xem cao nhất</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ngày</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Lượt xem</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Peak viewers</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Unique viewers</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Duration</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {streams.map((s, i) => (
              <tr key={s.sessionId} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3">
                  {formatDistanceToNow(new Date(s.startedAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {s.totalViews.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-red-400">↑ {s.peakViewers.toLocaleString()}</span>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {s.uniqueViewers.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {fmtDuration(s.durationSec)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-green-400">
                  {s.donationCents > 0 ? fmtCents(s.donationCents) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
