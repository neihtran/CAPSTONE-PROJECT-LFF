"use client";

import React from "react";
import Image from "next/image";

import { StreamerLevelBadge } from "@/components/ranks/streamer-level-badge";
import type { StreamerLevelTier } from "@/lib/streamer-level-service";

export type StreamerRank = {
  userId: string;
  username: string;
  imageUrl: string;
  xp: number;
  totalHours: number;
  level: StreamerLevelTier;
};

export function StreamerLeaderboard({ leaders }: { leaders: StreamerRank[] }) {
  if (leaders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">⭐ Chưa có dữ liệu Streamer Leaderboard</p>
        <p className="text-sm mt-2">Hãy là người đầu tiên livestream!</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {leaders.map((leader, idx) => (
        <div
          key={leader.userId}
          className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${
            idx % 2 === 0 ? "bg-muted/20" : ""
          }`}
        >
          <span className="text-muted-foreground font-mono w-8 text-right">
            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
          </span>
          <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0"
            style={{ borderColor: leader.level.color + "60" }}>
            {leader.imageUrl && (
              <Image
                src={leader.imageUrl}
                alt={leader.username}
                fill
                className="object-cover"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{leader.username}</p>
            <div className="flex items-center gap-2 mt-1">
              <StreamerLevelBadge level={leader.level} variant="compact" className="text-xs" />
              <span className="text-xs text-muted-foreground">
                {leader.totalHours.toFixed(0)}h streamed
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-amber-400 font-mono font-bold">
              {leader.xp.toLocaleString()} XP
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
