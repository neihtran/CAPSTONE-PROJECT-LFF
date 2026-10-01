import React, { Suspense } from "react";

import { getRoyalLeaderboard } from "@/lib/rank-service";
import { getStreamerLeaderboard } from "@/lib/streamer-level-service";
import { getTierFromWealth } from "@/lib/rank-service";
import { getLevelFromXp } from "@/lib/streamer-level-service";

import { RoyalLeaderboard } from "@/components/ranks/royal-leaderboard";
import { StreamerLeaderboard } from "@/components/ranks/streamer-leaderboard";

export const dynamic = "force-dynamic";

export default async function RanksPage() {
  const [royalRows, streamerRows] = await Promise.all([
    getRoyalLeaderboard(100),
    getStreamerLeaderboard(100),
  ]);

  const royalLeaders = royalRows.map((r) => ({
    userId: r.userId,
    username: r.user.username,
    imageUrl: r.user.imageUrl,
    wealthValue: r.wealthValue,
    tier: getTierFromWealth(r.wealthValue),
    currentTier: r.currentTier,
  }));

  const streamerLeaders = streamerRows.map((s) => ({
    userId: s.userId,
    username: s.user.username,
    imageUrl: s.user.imageUrl,
    xp: s.xp,
    totalHours: s.totalHours,
    level: getLevelFromXp(s.xp),
  }));

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">
          🏆 Top Leaderboards
        </h1>
        <p className="text-muted-foreground mt-1">
          Top donators và streamers trên toàn platform
        </p>
      </div>

      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span>👑</span> Royal Leaderboard
          <span className="text-xs text-muted-foreground font-normal ml-2">
            (Top 100 donators)
          </span>
        </h2>
        <Suspense fallback={<div>Loading...</div>}>
          <RoyalLeaderboard leaders={royalLeaders} />
        </Suspense>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span>⭐</span> Streamer Leaderboard
          <span className="text-xs text-muted-foreground font-normal ml-2">
            (Top 100 theo XP)
          </span>
        </h2>
        <Suspense fallback={<div>Loading...</div>}>
          <StreamerLeaderboard leaders={streamerLeaders} />
        </Suspense>
      </section>

      {/* Tier Legend */}
      <section className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-bold mb-3">Royal Tier System</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2"><span>👤</span> Peasant — 0 WP</div>
          <div className="flex items-center gap-2"><span>🛡️</span> Knight — 1K WP</div>
          <div className="flex items-center gap-2"><span>👑</span> Earl — 5K WP</div>
          <div className="flex items-center gap-2"><span>⚔️</span> Duke — 20K WP</div>
          <div className="flex items-center gap-2"><span>👑</span> King — 100K WP</div>
          <div className="flex items-center gap-2"><span>🏆</span> Emperor — 300K WP</div>
        </div>
      </section>
    </div>
  );
}
