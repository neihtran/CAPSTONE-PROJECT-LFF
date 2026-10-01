/**
 * RankService — Viewer Rank System (Royal Level).
 *
 * 6 tiers dựa trên wealth value (= total donation cents across all streamers):
 *
 *   PEASANT    0 → 999     👤
 *   KNIGHT     1K → 4.9K   🛡️
 *   EARL       5K → 19K    👑
 *   DUKE       20K → 99K   ⚔️
 *   KING       100K → 299K 👑
 *   EMPEROR    300K+       🏆
 *
 * 2 scopes:
 *   - Global: tổng donate cho tất cả streamers → tier cao nhất.
 *   - Per-channel: tổng donate cho 1 streamer → tier riêng trong chat của họ.
 *
 * Lifetime, permanent. KHÔNG giảm.
 */

import { db } from "@/lib/db";

// ──────────────────────────────────────────────────────────────────────────
// TIER DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────

export type RankTierId = "PEASANT" | "KNIGHT" | "EARL" | "DUKE" | "KING" | "EMPEROR";

export type RankTier = {
  id: RankTierId;
  label: string;
  icon: string;
  minWealth: number;
  maxWealth: number | null; // null = no upper limit
  color: string; // hex color cho UI
  bgClass: string; // tailwind class
};

export const RANK_TIERS: RankTier[] = [
  {
    id: "PEASANT",
    label: "Peasant",
    icon: "👤",
    minWealth: 0,
    maxWealth: 999,
    color: "#9CA3AF",
    bgClass: "bg-gray-500/20 border-gray-500/40",
  },
  {
    id: "KNIGHT",
    label: "Knight",
    icon: "🛡️",
    minWealth: 1_000,
    maxWealth: 4_999,
    color: "#10B981",
    bgClass: "bg-emerald-500/20 border-emerald-500/40",
  },
  {
    id: "EARL",
    label: "Earl",
    icon: "👑",
    minWealth: 5_000,
    maxWealth: 19_999,
    color: "#3B82F6",
    bgClass: "bg-blue-500/20 border-blue-500/40",
  },
  {
    id: "DUKE",
    label: "Duke",
    icon: "⚔️",
    minWealth: 20_000,
    maxWealth: 99_999,
    color: "#A855F7",
    bgClass: "bg-purple-500/20 border-purple-500/40",
  },
  {
    id: "KING",
    label: "King",
    icon: "👑",
    minWealth: 100_000,
    maxWealth: 299_999,
    color: "#F59E0B",
    bgClass: "bg-amber-500/20 border-amber-500/40",
  },
  {
    id: "EMPEROR",
    label: "Emperor",
    icon: "🏆",
    minWealth: 300_000,
    maxWealth: null,
    color: "#EF4444",
    bgClass: "bg-red-500/20 border-red-500/40",
  },
];

/**
 * Tính tier từ wealth value.
 */
export const getTierFromWealth = (wealthValue: number): RankTier => {
  for (const tier of RANK_TIERS) {
    if (wealthValue >= tier.minWealth && (tier.maxWealth === null || wealthValue <= tier.maxWealth)) {
      return tier;
    }
  }
  return RANK_TIERS[0]; // fallback PEASANT
};

/**
 * Tính % progress tới tier kế tiếp.
 */
export const getProgressToNextTier = (wealthValue: number): {
  currentTier: RankTier;
  nextTier: RankTier | null;
  progressPct: number;
  wealthNeeded: number;
} => {
  const currentTier = getTierFromWealth(wealthValue);
  const nextTierIdx = RANK_TIERS.findIndex((t) => t.id === currentTier.id) + 1;
  const nextTier = nextTierIdx < RANK_TIERS.length ? RANK_TIERS[nextTierIdx] : null;

  if (!nextTier) {
    return { currentTier, nextTier: null, progressPct: 100, wealthNeeded: 0 };
  }

  const progress =
    currentTier.maxWealth === null
      ? 100
      : Math.min(
          100,
          Math.round(
            ((wealthValue - currentTier.minWealth) /
              ((nextTier.minWealth) - currentTier.minWealth)) *
              100
          )
        );

  return {
    currentTier,
    nextTier,
    progressPct: progress,
    wealthNeeded: Math.max(0, nextTier.minWealth - wealthValue),
  };
};

// ──────────────────────────────────────────────────────────────────────────
// GLOBAL RANK (cross-platform)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Lấy hoặc tạo global ViewerRank cho 1 user.
 */
export const getOrCreateViewerRank = async (userId: string) => {
  let rank = await db.viewerRank.findUnique({
    where: { userId },
  });

  if (!rank) {
    rank = await db.viewerRank.create({
      data: { userId },
    });
  }

  return rank;
};

/**
 * Cộng wealth value khi user donate → update global rank.
 *
 * Returns:
 *   - previousTier
 *   - newTier
 *   - leveledUp: boolean
 *
 * Được gọi SAU khi donation record đã được tạo.
 */
export const addViewerWealth = async (params: {
  userId: string;
  amountCents: number;
  streamerId?: string; // nếu có → cũng update per-channel rank
}): Promise<{ leveledUp: boolean; previousTier: string; newTier: string }> => {
  const rank = await getOrCreateViewerRank(params.userId);
  const previousTier = rank.currentTier;

  // Compute new tier.
  const newWealth = rank.wealthValue + params.amountCents;
  const newTier = getTierFromWealth(newWealth);

  // Update global rank.
  await db.viewerRank.update({
    where: { userId: params.userId },
    data: {
      wealthValue: { increment: params.amountCents },
      donationCount: { increment: 1 },
      currentTier: newTier.id,
    },
  });

  // Update per-channel rank nếu có.
  if (params.streamerId) {
    await addChannelWealth({
      userId: params.userId,
      streamerId: params.streamerId,
      amountCents: params.amountCents,
    });
  }

  return {
    leveledUp: previousTier !== newTier.id,
    previousTier,
    newTier: newTier.id,
  };
};

/**
 * Lấy rank info cho viewer (global).
 */
export const getViewerRank = async (userId: string) => {
  const rank = await getOrCreateViewerRank(userId);
  const tier = getTierFromWealth(rank.wealthValue);
  const progress = getProgressToNextTier(rank.wealthValue);

  return {
    rank,
    tier,
    progress,
  };
};

// ──────────────────────────────────────────────────────────────────────────
// PER-CHANNEL RANK (fan club)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Cộng wealth value cho 1 channel cụ thể.
 */
export const addChannelWealth = async (params: {
  userId: string;
  streamerId: string;
  amountCents: number;
}) => {
  // Ensure ViewerRank exists.
  await getOrCreateViewerRank(params.userId);

  // Upsert per-channel rank.
  const existing = await db.viewerChannelRank.findUnique({
    where: {
      viewerId_streamerId: {
        viewerId: params.userId,
        streamerId: params.streamerId,
      },
    },
  });

  if (existing) {
    const newWealth = existing.channelWealthValue + params.amountCents;
    const newTier = getTierFromWealth(newWealth).id;
    return db.viewerChannelRank.update({
      where: { id: existing.id },
      data: {
        channelWealthValue: { increment: params.amountCents },
        currentTier: newTier,
      },
    });
  }

  const newTier = getTierFromWealth(params.amountCents).id;
  return db.viewerChannelRank.create({
    data: {
      viewerId: params.userId,
      streamerId: params.streamerId,
      channelWealthValue: params.amountCents,
      currentTier: newTier,
    },
  });
};

/**
 * Lấy per-channel rank.
 */
export const getViewerChannelRank = async (userId: string, streamerId: string) => {
  const rank = await db.viewerChannelRank.findUnique({
    where: {
      viewerId_streamerId: {
        viewerId: userId,
        streamerId,
      },
    },
  });

  if (!rank) return null;

  return {
    rank,
    tier: getTierFromWealth(rank.channelWealthValue),
    progress: getProgressToNextTier(rank.channelWealthValue),
  };
};

// ──────────────────────────────────────────────────────────────────────────
// LEADERBOARDS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Top global donators (royal leaderboard).
 */
export const getRoyalLeaderboard = async (limit = 100) => {
  return db.viewerRank.findMany({
    where: { wealthValue: { gt: 0 } },
    orderBy: { wealthValue: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          imageUrl: true,
        },
      },
    },
  });
};

/**
 * Top donators cho 1 streamer (per-channel leaderboard).
 */
export const getStreamerLeaderboard = async (streamerId: string, limit = 50) => {
  return db.viewerChannelRank.findMany({
    where: { streamerId, channelWealthValue: { gt: 0 } },
    orderBy: { channelWealthValue: "desc" },
    take: limit,
  });
};
