"use client";

import React from "react";
import Image from "next/image";

import { RoyalBadge } from "@/components/ranks/royal-badge";
import type { RankTier } from "@/lib/rank-service";

export type RoyalLeader = {
  userId: string;
  username: string;
  imageUrl: string;
  wealthValue: number;
  tier: RankTier;
  currentTier: string;
};

/**
 * RoyalLeaderboard — top donators ranking page.
 *
 * Top 100 viewers by total wealth value across platform.
 */
export function RoyalLeaderboard({ leaders }: { leaders: RoyalLeader[] }) {
  if (leaders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">👑 Chưa có dữ liệu Royal Leaderboard</p>
        <p className="text-sm mt-2">Hãy là người đầu tiên donate!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[1, 0, 2].map((idx) => {
          const leader = leaders[idx];
          if (!leader) return <div key={idx} />;
          const positions = ["🥇", "🥈", "🥉"];
          return (
            <div
              key={leader.userId}
              className={`rounded-xl p-4 text-center border ${
                idx === 0
                  ? "border-yellow-500/50 bg-gradient-to-b from-yellow-500/10 to-transparent"
                  : idx === 1
                  ? "border-gray-400/50 bg-gradient-to-b from-gray-400/10 to-transparent"
                  : "border-amber-700/50 bg-gradient-to-b from-amber-700/10 to-transparent"
              }`}
            >
              <div className="text-2xl mb-2">{positions[idx]}</div>
              <div className="relative w-12 h-12 mx-auto rounded-full overflow-hidden border-2 border-white/20">
                {leader.imageUrl && (
                  <Image
                    src={leader.imageUrl}
                    alt={leader.username}
                    fill
                    className="object-cover"
                  />
                )}
              </div>
              <p className="mt-2 font-bold text-white truncate">{leader.username}</p>
              <RoyalBadge tier={leader.tier} variant="compact" className="text-base mt-1 justify-center" />
              <p className="mt-1 text-xs text-yellow-400 font-mono">
                {leader.wealthValue.toLocaleString()} WP
              </p>
            </div>
          );
        })}
      </div>

      {/* Rest of leaderboard */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {leaders.slice(3).map((leader, idx) => (
          <div
            key={leader.userId}
            className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${
              idx % 2 === 0 ? "bg-muted/20" : ""
            }`}
          >
            <span className="text-muted-foreground font-mono w-8 text-right">
              #{idx + 4}
            </span>
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
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
              <RoyalBadge tier={leader.tier} variant="compact" className="text-xs" />
            </div>
            <span className="text-yellow-400 font-mono font-semibold text-sm">
              {leader.wealthValue.toLocaleString()} WP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
