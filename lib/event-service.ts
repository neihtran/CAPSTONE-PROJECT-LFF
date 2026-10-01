/**
 * EventService — Stream events (goals, milestones, competitions).
 *
 * Features:
 *   - Create custom events (DONATION_GOAL, SUB_MILESTONE, VIEWER_MILESTONE, etc.).
 *   - Auto-progress tracking khi donation / sub / follow xảy ra.
 *   - Mark COMPLETED khi đạt targetValue.
 *   - Mark EXPIRED khi quá endsAt.
 *   - Per-user contribution tracking (top contributors leaderboard).
 *
 * Tất cả mutation chạy non-blocking; trigger từ các service khác.
 */

import { db } from "@/lib/db";

// ──────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────

export const EVENT_TYPES = [
  "DONATION_GOAL",
  "SUBSCRIPTION_MILESTONE",
  "VIEWER_MILESTONE",
  "FOLLOW_GOAL",
  "CUSTOM",
  "STREAMER_MILESTONE",
  "MONTHLY_COMPETITION",
  "CHALLENGE",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUS = [
  "ACTIVE",
  "COMPLETED",
  "EXPIRED",
  "CANCELLED",
  "ENDED",
] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];

export const EVENT_SOURCE = [
  "donation",
  "subscription",
  "follow",
  "manual",
  "viewer_count",
] as const;
export type EventSource = (typeof EVENT_SOURCE)[number];

// ──────────────────────────────────────────────────────────────────────────
// VALIDATION
// ──────────────────────────────────────────────────────────────────────────

export type CreateEventInput = {
  streamerId: string;
  type: EventType;
  title: string;
  body: string;
  targetValue: number;
  rewardValueCents?: number;
  rewardDescription?: string;
  linkUrl?: string;
  endsAt?: Date | null;
  startsAt?: Date | null;
  priority?: number;
};

export const validateEventInput = (input: CreateEventInput): string | null => {
  if (!input.title.trim()) return "Title is required";
  if (input.title.length > 200) return "Title must be ≤ 200 characters";
  if (!input.body.trim()) return "Body is required";
  if (input.targetValue <= 0) return "Target must be > 0";
  if (input.endsAt && input.startsAt && input.endsAt < input.startsAt) {
    return "endsAt must be after startsAt";
  }
  return null;
};

// ──────────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────────

export const createEvent = async (input: CreateEventInput) => {
  const error = validateEventInput(input);
  if (error) throw new Error(error);

  return db.streamEvent.create({
    data: {
      streamerId: input.streamerId,
      type: input.type,
      title: input.title.trim(),
      body: input.body.trim(),
      targetValue: input.targetValue,
      rewardValueCents: input.rewardValueCents ?? 0,
      rewardDescription: input.rewardDescription,
      linkUrl: input.linkUrl,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      priority: input.priority ?? 0,
      status: "ACTIVE",
    },
  });
};

export const cancelEvent = async (eventId: string, streamerId: string) => {
  // Ensure ownership.
  const event = await db.streamEvent.findUnique({
    where: { id: eventId },
    select: { streamerId: true, status: true },
  });
  if (!event) throw new Error("Event not found");
  if (event.streamerId !== streamerId) throw new Error("Forbidden");
  if (event.status !== "ACTIVE") throw new Error("Event is not active");

  return db.streamEvent.update({
    where: { id: eventId },
    data: { status: "CANCELLED" },
  });
};

// ──────────────────────────────────────────────────────────────────────────
// QUERIES
// ──────────────────────────────────────────────────────────────────────────

/**
 * Lấy active events cho 1 streamer (kèm progress %).
 */
export const getStreamerActiveEvents = async (streamerId: string) => {
  return db.streamEvent.findMany({
    where: {
      streamerId,
      status: "ACTIVE",
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
};

/**
 * Lấy events đang ACTIVE trên toàn platform (homepage listing).
 */
export const getActiveEvents = async (limit = 50) => {
  const now = new Date();
  return db.streamEvent.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      streamer: {
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
 * Lấy events completed gần đây (showcase).
 */
export const getCompletedEvents = async (limit = 20) => {
  return db.streamEvent.findMany({
    where: {
      status: { in: ["COMPLETED", "ENDED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      streamer: {
        select: { id: true, username: true, imageUrl: true },
      },
    },
  });
};

/**
 * Lấy event by ID.
 */
export const getEventById = async (eventId: string) => {
  return db.streamEvent.findUnique({
    where: { id: eventId },
    include: {
      streamer: { select: { id: true, username: true, imageUrl: true } },
    },
  });
};

// ──────────────────────────────────────────────────────────────────────────
// PROGRESS TRACKING
// ──────────────────────────────────────────────────────────────────────────

/**
 * Auto-progress event khi có donation / subscription / follow.
 * Được gọi từ donation-service và follow-service.
 *
 * Returns: events đã COMPLETED trong lần gọi này (để trigger alert).
 */
export const progressEventFromContribution = async (params: {
  streamerId: string;
  source: EventSource;
  amount: number;
  userId?: string;
}): Promise<Array<{ eventId: string; type: string; title: string; completed: boolean }>> => {
  // Map source → event types cần progress.
  const typeMap: Record<EventSource, EventType[]> = {
    donation: ["DONATION_GOAL"],
    subscription: ["SUBSCRIPTION_MILESTONE"],
    follow: ["FOLLOW_GOAL"],
    viewer_count: ["VIEWER_MILESTONE"],
    manual: [],
  };

  const matchingTypes = typeMap[params.source];
  if (matchingTypes.length === 0) return [];

  // Find ACTIVE events matching type.
  const events = await db.streamEvent.findMany({
    where: {
      streamerId: params.streamerId,
      status: "ACTIVE",
      type: { in: matchingTypes },
    },
  });

  const completedEvents: Array<{ eventId: string; type: string; title: string; completed: boolean }> = [];

  for (const event of events) {
    const newValue = event.currentValue + params.amount;
    const isCompleted = newValue >= event.targetValue;

    await db.streamEvent.update({
      where: { id: event.id },
      data: {
        currentValue: newValue,
        status: isCompleted ? "COMPLETED" : "ACTIVE",
      },
    });

    // Track per-user contribution.
    if (params.userId) {
      await db.eventContribution.create({
        data: {
          eventId: event.id,
          userId: params.userId,
          amount: params.amount,
          source: params.source,
        },
      });
    }

    if (isCompleted) {
      completedEvents.push({
        eventId: event.id,
        type: event.type,
        title: event.title,
        completed: true,
      });
    }
  }

  return completedEvents;
};

/**
 * Lấy top contributors cho 1 event.
 */
export const getEventTopContributors = async (
  eventId: string,
  limit = 10
) => {
  // Aggregate contributions.
  const grouped = await db.eventContribution.groupBy({
    by: ["userId"],
    where: { eventId },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  // Fetch user info.
  const userIds = grouped.map((g) => g.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, imageUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return grouped.map((g) => ({
    userId: g.userId,
    user: userMap.get(g.userId),
    totalAmount: g._sum.amount ?? 0,
    contributionCount: g._count.id,
  }));
};

/**
 * Auto-expire events đã quá hạn (background job).
 */
export const expireOverdueEvents = async () => {
  const now = new Date();
  return db.streamEvent.updateMany({
    where: {
      status: "ACTIVE",
      endsAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });
};

// ──────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Calculate progress % (0-100).
 */
export const getProgressPct = (
  current: number,
  target: number
): number => {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
};

/**
 * Format event type cho UI.
 */
export const getEventTypeMeta = (type: EventType) => {
  const map: Record<EventType, { label: string; icon: string; color: string }> = {
    DONATION_GOAL: { label: "Donation Goal", icon: "💰", color: "text-yellow-400" },
    SUBSCRIPTION_MILESTONE: { label: "Subscriber Milestone", icon: "⭐", color: "text-purple-400" },
    VIEWER_MILESTONE: { label: "Viewer Milestone", icon: "👁️", color: "text-blue-400" },
    FOLLOW_GOAL: { label: "Follow Goal", icon: "💚", color: "text-green-400" },
    CUSTOM: { label: "Custom Goal", icon: "🎯", color: "text-orange-400" },
    STREAMER_MILESTONE: { label: "Streamer Milestone", icon: "🏆", color: "text-amber-400" },
    MONTHLY_COMPETITION: { label: "Monthly Competition", icon: "📅", color: "text-pink-400" },
    CHALLENGE: { label: "Challenge", icon: "🎮", color: "text-red-400" },
  };
  return map[type] ?? map.CUSTOM;
};

/**
 * Format giá trị tiền (cents → $).
 */
export const formatEventValue = (cents: number, type: EventType): string => {
  if (type === "DONATION_GOAL" || type === "CUSTOM") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(cents);
  }
  return cents.toLocaleString();
};
