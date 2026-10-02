/**
 * SubscriptionService — quản lý subscribe tiers + subscriptions.
 *
 * Mỗi streamer có N SubscriptionTier (T1/T2/T3...).
 * User subscribe 1 tier → Subscription row.
 * Re-subscribe = update Subscription row.
 *
 * Billing: lib/payment-stub.ts (mock). Để upgrade lên Stripe real:
 *   - Thay paymentStub bằng Stripe SDK calls.
 *   - Thêm webhook handler cho stripe events (payment_intent.succeeded,
 *     invoice.payment_succeeded, customer.subscription.deleted...).
 *
 * Validation:
 *   - Subscriber ≠ streamer (không tự sub chính mình).
 *   - Tier phải ACTIVE.
 *   - Subscription period: 1 tháng.
 */

import { db } from "@/lib/db";
import {
  createSubscriptionIntent,
  renewSubscriptionIntent,
} from "@/lib/payment-stub";

export type TierWithStats = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  level: number;
  color: string;
  status: string;
  subscriberCount: number;
};

// ──────────────────────────────────────────────────────────────────────────
// TIER MANAGEMENT (streamer side)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Lấy tất cả tiers của 1 streamer (kèm subscriber count).
 */
export const getStreamerTiers = async (streamerId: string) => {
  return db.subscriptionTier.findMany({
    where: { streamerId, status: "ACTIVE" },
    orderBy: { level: "asc" },
    include: {
      _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
    },
  });
};

/**
 * Tạo 1 tier mới cho streamer.
 * Default: 3 tiers (Bronze=$4.99, Silver=$9.99, Gold=$19.99).
 */
export const createTier = async (params: {
  streamerId: string;
  name: string;
  description?: string;
  priceCents: number;
  level: number;
  color?: string;
}) => {
  return db.subscriptionTier.create({
    data: {
      streamerId: params.streamerId,
      name: params.name,
      description: params.description,
      priceCents: params.priceCents,
      level: params.level,
      color: params.color ?? "#9146FF",
      status: "ACTIVE",
    },
  });
};

/**
 * Update tier (name, description, price, color).
 * Không cho update level (vì unique constraint).
 */
export const updateTier = async (
  tierId: string,
  streamerId: string,
  updates: {
    name?: string;
    description?: string;
    priceCents?: number;
    color?: string;
  }
) => {
  return db.subscriptionTier.updateMany({
    where: { id: tierId, streamerId, status: "ACTIVE" },
    data: updates,
  });
};

/**
 * Disable 1 tier (không xóa — giữ lại để analytics).
 */
export const disableTier = async (tierId: string, streamerId: string) => {
  return db.subscriptionTier.updateMany({
    where: { id: tierId, streamerId },
    data: { status: "DISABLED" },
  });
};

// ──────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION MANAGEMENT (subscriber side)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Check xem user đã sub streamer này chưa (và ở tier nào).
 */
export const getMySubscription = async (
  subscriberId: string,
  streamerId: string
) => {
  return db.subscription.findFirst({
    where: {
      subscriberId,
      streamerId,
      status: { in: ["ACTIVE", "CANCELED"] },
    },
    include: {
      tier: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Subscribe 1 streamer theo tier.
 *
 * Flow:
 *   1. Validate (not self-sub, tier exists).
 *   2. Mock payment → get paymentRef.
 *   3. Upsert Subscription row (re-sub = update existing).
 *   4. Return subscription.
 *
 * Period: 1 month from now.
 */
export const subscribeToTier = async (params: {
  subscriberId: string;
  streamerId: string;
  tierId: string;
}): Promise<{ id: string; paymentRef: string; currentPeriodEnd: Date }> => {
  const { subscriberId, streamerId, tierId } = params;

  if (subscriberId === streamerId) {
    throw new Error("Bạn không thể tự subscribe chính mình");
  }

  const tier = await db.subscriptionTier.findFirst({
    where: { id: tierId, streamerId, status: "ACTIVE" },
    include: { subscriptions: false },
  });
  if (!tier) throw new Error("Tier không tồn tại hoặc đã bị disable");

  // Fix vấn đề 4 FIX-PROMPT-2.md: chặn hạ gói trong period hiện tại.
  // - Nâng gói (level lớn hơn): OK, giữ period (không reset), KHÔNG charge lại.
  // - Cùng gói: cảnh báo.
  // - Hạ gói: chặn đến khi period hết hạn.
  // - Period đã hết → reset về now + 1 tháng (mọi tier OK).
  // - CANCELED → cho phép re-activate ở bất kỳ gói nào.
  const existingSub = await db.subscription.findFirst({
    where: {
      subscriberId,
      streamerId,
      status: { in: ["ACTIVE", "CANCELED"] },
    },
    include: { tier: true },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const stillActive =
    existingSub &&
    existingSub.status === "ACTIVE" &&
    existingSub.currentPeriodEnd > now;

  if (stillActive && existingSub) {
    const currentLevel = existingSub.tier.level;
    const newLevel = tier.level;

    if (newLevel < currentLevel) {
      throw new Error(
        "Không thể hạ gói trong tháng hiện tại. Vui lòng đợi đến khi gói hiện tại hết hạn."
      );
    }
    if (newLevel === currentLevel) {
      throw new Error("Bạn đã subscribe gói này rồi");
    }
    // newLevel > currentLevel → nâng gói: GIỮ NGUYÊN period, không charge.
    const upgraded = await db.subscription.update({
      where: { id: existingSub.id },
      data: {
        tierId,
        // KHÔNG charge paymentRef mới (giữ nguyên payment gốc).
        // KHÔNG reset currentPeriodEnd.
        // Cộng dồn totalCentsPaid (delta) để analytics chính xác.
        totalCentsPaid: {
          increment: Math.max(0, tier.priceCents - existingSub.tier.priceCents),
        },
        canceledAt: null,
        status: "ACTIVE",
      },
    });

    // Alert + XP + event cho lần nâng gói.
    const subscriber = await db.user.findUnique({
      where: { id: subscriberId },
      select: { id: true, username: true },
    });
    Promise.all([
      (async () => {
        try {
          const { buildAlert } = await import("@/lib/alert-service");
          await buildAlert({
            streamerId,
            type: "SUBSCRIBE",
            username: subscriber?.username ?? "Anonymous",
            tierName: tier.name,
          });
        } catch (err) {
          console.warn("[subscribeToTier] alert trigger failed:", err);
        }
      })(),
      (async () => {
        try {
          const { recalculateStreamerXp } = await import(
            "@/lib/streamer-level-service"
          );
          await recalculateStreamerXp(streamerId);
        } catch (err) {
          console.warn("[subscribeToTier] XP recalc failed:", err);
        }
      })(),
    ]);

    return {
      id: upgraded.id,
      paymentRef: upgraded.paymentRef ?? existingSub.paymentRef ?? "",
      currentPeriodEnd: upgraded.currentPeriodEnd,
    };
  }

  // Fix vấn đề 4 FIX-PROMPT-2.md: Tạo mới hoặc re-activate khi đã hết hạn.
  // Reset period = now + 1 tháng.
  // Mock payment.
  const payment = await createSubscriptionIntent(
    tier.priceCents,
    subscriberId,
    tierId
  );
  if (!payment.success) {
    throw new Error(payment.error);
  }

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const sub = await db.subscription.findFirst({
    where: { subscriberId, streamerId },
  });

  let saved: { id: string; paymentRef: string | null; currentPeriodEnd: Date };

  if (sub) {
    // Re-subscribe (đã hết hạn hoặc đang CANCELED): update tier + reset period.
    const updated = await db.subscription.update({
      where: { id: sub.id },
      data: {
        tierId,
        paymentRef: payment.paymentRef,
        status: "ACTIVE",
        currentPeriodEnd: periodEnd,
        canceledAt: null,
      },
    });
    saved = {
      id: updated.id,
      paymentRef: updated.paymentRef,
      currentPeriodEnd: updated.currentPeriodEnd,
    };
  } else {
    const created = await db.subscription.create({
      data: {
        subscriberId,
        streamerId,
        tierId,
        paymentRef: payment.paymentRef,
        status: "ACTIVE",
        currentPeriodEnd: periodEnd,
        totalCentsPaid: tier.priceCents,
        monthsActive: 1,
      },
    });
    saved = {
      id: created.id,
      paymentRef: created.paymentRef,
      currentPeriodEnd: created.currentPeriodEnd,
    };
  }

  // Get subscriber info for alert.
  const subscriber = await db.user.findUnique({
    where: { id: subscriberId },
    select: { id: true, username: true },
  });

  // Trigger subscribe alert + recalc streamer XP (non-blocking).
  Promise.all([
    (async () => {
      try {
        const { buildAlert } = await import("@/lib/alert-service");
        await buildAlert({
          streamerId,
          type: "SUBSCRIBE",
          username: subscriber?.username ?? "Anonymous",
          tierName: tier.name,
        });
      } catch (err) {
        console.warn("[subscribeToTier] alert trigger failed:", err);
      }
    })(),
    (async () => {
      try {
        const { recalculateStreamerXp } = await import(
          "@/lib/streamer-level-service"
        );
        const result = await recalculateStreamerXp(streamerId);
        if (result.leveledUp) {
          console.log(
            `[streamer-level] ${streamerId} leveled up: ${result.previousLevel} → ${result.newLevel}`
          );
        }
      } catch (err) {
        console.warn("[subscribeToTier] XP recalc failed:", err);
      }
    })(),
    // Progress events (SUBSCRIPTION_MILESTONE).
    (async () => {
      try {
        const { progressEventFromContribution } = await import(
          "@/lib/event-service"
        );
        const completed = await progressEventFromContribution({
          streamerId,
          source: "subscription",
          amount: 1,
          userId: subscriber?.id,
        }).then((completed) => {
          for (const ev of completed) {
            console.log(`[event] sub milestone completed: ${ev.title}`);
          }
        });
      } catch (err) {
        console.warn("[subscribeToTier] event progress failed:", err);
      }
    })(),
  ]);

  return {
    id: saved.id,
    paymentRef: saved.paymentRef ?? payment.paymentRef,
    currentPeriodEnd: saved.currentPeriodEnd,
  };
};

/**
 * Cancel subscription — vẫn active đến currentPeriodEnd.
 * Không hoàn tiền (MVP).
 */
export const cancelSubscription = async (
  subscriberId: string,
  streamerId: string
) => {
  return db.subscription.updateMany({
    where: {
      subscriberId,
      streamerId,
      status: "ACTIVE",
    },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
    },
  });
};

/**
 * Renew subscription — gọi khi period hết hạn.
 * Production: webhook từ Stripe gọi hàm này.
 */
export const renewSubscription = async (params: {
  subscriberId: string;
  streamerId: string;
}): Promise<{ id: string }> => {
  const { subscriberId, streamerId } = params;

  const existing = await db.subscription.findFirst({
    where: { subscriberId, streamerId, status: "ACTIVE" },
    include: { tier: true },
  });

  if (!existing) throw new Error("Không tìm thấy subscription active");

  // Mock renew payment.
  const payment = await renewSubscriptionIntent(
    existing.paymentRef ?? `sub_stub_${Date.now()}`,
    existing.tier.priceCents
  );
  if (!payment.success) throw new Error(payment.error);

  const newPeriodEnd = new Date();
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

  const renewed = await db.subscription.update({
    where: { id: existing.id },
    data: {
      currentPeriodEnd: newPeriodEnd,
      status: "ACTIVE",
      totalCentsPaid: { increment: existing.tier.priceCents },
      monthsActive: { increment: 1 },
    },
  });

  return { id: renewed.id };
};

/**
 * Lấy danh sách tất cả subscription của 1 streamer (cho analytics).
 */
export const getStreamerSubscriptions = async (
  streamerId: string,
  options: { status?: string; limit?: number; offset?: number } = {}
) => {
  const { status = "ACTIVE", limit = 20, offset = 0 } = options;

  return db.subscription.findMany({
    where: { streamerId, status },
    include: {
      subscriber: { select: { id: true, username: true, imageUrl: true } },
      tier: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
};

/**
 * Tổng revenue (cents) của streamer từ subscriptions.
 */
export const getStreamerSubscriptionRevenue = async (
  streamerId: string
): Promise<number> => {
  const result = await db.subscription.aggregate({
    where: { streamerId, status: { in: ["ACTIVE", "EXPIRED", "CANCELED"] } },
    _sum: { totalCentsPaid: true },
  });
  return result._sum.totalCentsPaid ?? 0;
};
