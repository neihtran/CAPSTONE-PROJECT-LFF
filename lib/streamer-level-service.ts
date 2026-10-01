/**
 * StreamerLevelService — XP + level system cho streamer.
 *
 * XP formula (recalculated on stream end / subscription / milestone):
 *   XP = (totalHours * 100)
 *      + (totalFollowers * 10)
 *      + (totalUniqueViewers * 5)
 *      + (totalRevenueCents / 10)
 *
 * 6 tiers (xem STREAMER_LEVELS):
 *   NEW       0 → 999 XP      🌱
 *   RISING    1K → 4.9K       🌿
 *   POPULAR   5K → 24.9K      🌳
 *   FAMOUS    25K → 99K       ⭐
 *   STAR      100K → 499K     🌟
 *   ICON      500K+           💎
 *
 * Trigger:
 *   - On stream end → recalc XP.
 *   - On subscription → recalc XP.
 *   - On donation received → recalc XP (để cộng revenue).
 */

import { db } from "@/lib/db";

// ──────────────────────────────────────────────────────────────────────────
// LEVEL DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────

export type StreamerLevelId = "NEW" | "RISING" | "POPULAR" | "FAMOUS" | "STAR" | "ICON";

export type StreamerLevelTier = {
  id: StreamerLevelId;
  label: string;
  icon: string;
  minXp: number;
  maxXp: number | null;
  color: string;
};

export const STREAMER_LEVELS: StreamerLevelTier[] = [
  { id: "NEW",     label: "New",     icon: "🌱", minXp: 0,           maxXp: 999,         color: "#9CA3AF" },
  { id: "RISING",  label: "Rising",  icon: "🌿", minXp: 1_000,       maxXp: 4_999,       color: "#10B981" },
  { id: "POPULAR", label: "Popular", icon: "🌳", minXp: 5_000,       maxXp: 24_999,      color: "#3B82F6" },
  { id: "FAMOUS",  label: "Famous",  icon: "⭐", minXp: 25_000,      maxXp: 99_999,      color: "#A855F7" },
  { id: "STAR",    label: "Star",    icon: "🌟", minXp: 100_000,     maxXp: 499_999,     color: "#F59E0B" },
  { id: "ICON",    label: "Icon",    icon: "💎", minXp: 500_000,     maxXp: null,        color: "#EF4444" },
];

export const getLevelFromXp = (xp: number): StreamerLevelTier => {
  for (const lvl of STREAMER_LEVELS) {
    if (xp >= lvl.minXp && (lvl.maxXp === null || xp <= lvl.maxXp)) {
      return lvl;
    }
  }
  return STREAMER_LEVELS[0];
};

export const getProgressToNextLevel = (xp: number) => {
  const current = getLevelFromXp(xp);
  const nextIdx = STREAMER_LEVELS.findIndex((l) => l.id === current.id) + 1;
  const next = nextIdx < STREAMER_LEVELS.length ? STREAMER_LEVELS[nextIdx] : null;

  if (!next) {
    return { current, next: null, progressPct: 100, xpNeeded: 0 };
  }

  const progress = Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100);

  return {
    current,
    next,
    progressPct: Math.min(100, Math.max(0, progress)),
    xpNeeded: Math.max(0, next.minXp - xp),
  };
};

// ──────────────────────────────────────────────────────────────────────────
// XP CALCULATION
// ──────────────────────────────────────────────────────────────────────────

/**
 * Recalculate XP cho 1 streamer dựa trên stats hiện tại.
 *
 * Called từ:
 *   - onStreamSessionEnd → update hours.
 *   - onSubscription / onDonation → update revenue.
 *
 * Returns: { leveledUp, previousLevel, newLevel }
 */
export const recalculateStreamerXp = async (
  userId: string
): Promise<{ leveledUp: boolean; previousLevel: string; newLevel: string; xp: number }> => {
  // Aggregate stats.
  const sessions = await db.streamSession.findMany({
    where: {
      stream: { userId },
    },
    select: {
      durationSec: true,
      peakViewers: true,
      donationCents: true,
      uniqueViewers: true,
    },
  });

  const totalHours = sessions.reduce((sum, s) => sum + (s.durationSec ?? 0) / 3600, 0);

  const totalRevenue = await db.subscription.aggregate({
    where: { streamerId: userId },
    _sum: { totalCentsPaid: true },
  });
  const totalRevenueCents = (totalRevenue._sum.totalCentsPaid ?? 0) +
    sessions.reduce((sum, s) => sum + (s.donationCents ?? 0), 0);

  const followers = await db.user.findUnique({
    where: { id: userId },
    select: { _count: { select: { followedBy: true } } },
  });
  const totalFollowers = followers?._count.followedBy ?? 0;

  const totalUniqueViewers = sessions.reduce(
    (sum, s) => sum + (s.uniqueViewers ?? 0),
    0
  );

  // XP formula.
  const xp =
    Math.floor(totalHours * 100) +
    totalFollowers * 10 +
    totalUniqueViewers * 5 +
    Math.floor(totalRevenueCents / 10);

  // Determine level.
  const newLevel = getLevelFromXp(xp);

  // Get existing level.
  const existing = await db.streamerLevel.findUnique({ where: { userId } });
  const previousLevel = existing?.currentLevel ?? "NEW";

  // Ensure row exists.
  await db.streamerLevel.upsert({
    where: { userId },
    create: {
      userId,
      xp,
      currentLevel: newLevel.id,
      totalHours,
      totalRevenueCents,
      totalUniqueViewers,
      peakLevel: newLevel.id,
    },
    update: {
      xp,
      currentLevel: newLevel.id,
      totalHours,
      totalRevenueCents,
      totalUniqueViewers,
      peakLevel: newLevel.id,
    },
  });

  return {
    leveledUp: previousLevel !== newLevel.id,
    previousLevel,
    newLevel: newLevel.id,
    xp,
  };
};

/**
 * Lấy level info cho 1 streamer.
 */
export const getStreamerLevel = async (userId: string) => {
  const lvl = await db.streamerLevel.findUnique({ where: { userId } });
  if (!lvl) {
    return {
      level: STREAMER_LEVELS[0],
      progress: getProgressToNextLevel(0),
      xp: 0,
      totalHours: 0,
      currentLevel: STREAMER_LEVELS[0].id,
    };
  }

  const tier = getLevelFromXp(lvl.xp);
  const progress = getProgressToNextLevel(lvl.xp);

  return {
    level: tier,
    progress,
    xp: lvl.xp,
    totalHours: lvl.totalHours,
    currentLevel: tier.id,
  };
};

// ──────────────────────────────────────────────────────────────────────────
// LEADERBOARD
// ──────────────────────────────────────────────────────────────────────────

/**
 * Top streamers (highest XP).
 */
export const getStreamerLeaderboard = async (limit = 100) => {
  return db.streamerLevel.findMany({
    where: { xp: { gt: 0 } },
    orderBy: { xp: "desc" },
    take: limit,
    include: {
      user: {
        select: { id: true, username: true, imageUrl: true },
      },
    },
  });
};
