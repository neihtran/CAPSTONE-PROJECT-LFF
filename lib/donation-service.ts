/**
 * DonationService — quản lý 1-lần tips.
 *
 * Khác subscription: donation là 1 lần, không recurring.
 * Được dùng khi viewer muốn tip streamer (vì yêu thích stream,
 * muốn ủng hộ mà không cam kết monthly sub).
 *
 * Flow:
 *   1. Viewer chọn amount (preset buttons hoặc custom).
 *   2. Server tạo Donation row với status PENDING.
 *   3. Stub payment → nếu success → update COMPLETED.
 *   4. Streamer thấy donation trên overlay / notification.
 *
 * Preset amounts (VNĐ): 5K, 10K, 20K, 50K, 100K, 200K.
 */

import { db } from "@/lib/db";
import { createDonationIntent } from "@/lib/payment-stub";

export const PRESET_AMOUNTS = [5_000, 10_000, 20_000, 50_000, 100_000, 200_000] as const;

export type DonationWithActor = Awaited<ReturnType<typeof getRecentDonations>>[number];

// ──────────────────────────────────────────────────────────────────────────
// DONATION FLOW
// ──────────────────────────────────────────────────────────────────────────

export type CreateDonationResult = {
  id: string;
  paymentRef: string;
  status: string;
};

/**
 * Tạo 1 donation (stub payment → COMPLETED).
 *
 * @param donorId — null nếu donate ẩn danh.
 */
export const createDonation = async (params: {
  amountCents: number;
  donorId?: string | null;
  recipientId: string;
  streamId?: string | null;
  message?: string;
}): Promise<CreateDonationResult> => {
  const { amountCents, donorId = null, recipientId, streamId = null, message } = params;

  // Validate amount (VNĐ).
  if (amountCents < 1_000) {
    throw new Error("Số tiền tối thiểu là 1.000 đ");
  }
  if (amountCents > 10_000_000) {
    throw new Error("Số tiền tối đa là 10.000.000 đ");
  }

  // Stub payment.
  const payment = await createDonationIntent(amountCents, donorId ?? undefined);
  if (!payment.success) {
    throw new Error(payment.error);
  }

  const donation = await db.donation.create({
    data: {
      amountCents,
      donorId,
      recipientId,
      streamId,
      message: message?.slice(0, 500) ?? null,
      paymentRef: payment.paymentRef,
      status: "COMPLETED",
    },
  });

  // Update session stats + trigger alert (non-blocking).
  Promise.all([
    streamId
      ? (async () => {
          const latestSession = await db.streamSession.findFirst({
            where: { streamId, endedAt: null },
            orderBy: { startedAt: "desc" },
          });
          if (latestSession) {
            await db.streamSession.update({
              where: { id: latestSession.id },
              data: { donationCents: { increment: amountCents } },
            });
          }
        })()
      : Promise.resolve(),
    (async () => {
      try {
        const { buildAlert } = await import("@/lib/alert-service");
        // Get donor username for alert.
        let donorUsername = "Anonymous";
        if (donorId) {
          const donorUser = await db.user.findUnique({
            where: { id: donorId },
            select: { username: true },
          });
          donorUsername = donorUser?.username ?? "Anonymous";
        }
        await buildAlert({
          streamerId: recipientId,
          type: "DONATION",
          username: donorUsername,
          amountCents,
          message,
        });
      } catch (err) {
        console.warn("[createDonation] alert trigger failed:", err);
      }
    })(),
    // Update viewer rank (wealth value → tier).
    donorId
      ? (async () => {
          try {
            const { addViewerWealth } = await import("@/lib/rank-service");
            const result = await addViewerWealth({
              userId: donorId,
              amountCents,
              streamerId: recipientId,
            });
            if (result.leveledUp) {
              console.log(
                `[rank] ${donorId} leveled up: ${result.previousTier} → ${result.newTier}`
              );
            }
            // Also update streamer XP.
            try {
              const { recalculateStreamerXp } = await import(
                "@/lib/streamer-level-service"
              );
              await recalculateStreamerXp(recipientId);
            } catch (err) {
              console.warn("[createDonation] streamer XP recalc failed:", err);
            }
            // Progress events (DONATION_GOAL).
            try {
              const { progressEventFromContribution } = await import(
                "@/lib/event-service"
              );
              const completed = await progressEventFromContribution({
                streamerId: recipientId,
                source: "donation",
                amount: amountCents,
                userId: donorId,
              });
              for (const ev of completed) {
                console.log(
                  `[event] completed: ${ev.title} (${ev.type})`
                );
              }
            } catch (err) {
              console.warn("[createDonation] event progress failed:", err);
            }
          } catch (err) {
            console.warn("[createDonation] rank update failed:", err);
          }
        })()
      : Promise.resolve(),
  ]);

  return {
    id: donation.id,
    paymentRef: donation.paymentRef ?? payment.paymentRef,
    status: donation.status,
  };
};

// ──────────────────────────────────────────────────────────────────────────
// QUERIES
// ──────────────────────────────────────────────────────────────────────────

/**
 * Donation gần đây của 1 streamer (last 30 donations).
 */
export const getRecentDonations = async (
  streamerId: string,
  limit = 30
) => {
  return db.donation.findMany({
    where: {
      recipientId: streamerId,
      status: "COMPLETED",
    },
    include: {
      donor: { select: { id: true, username: true, imageUrl: true } },
      stream: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

/**
 * Donation của 1 user (viewer).
 */
export const getMyDonations = async (donorId: string, limit = 20) => {
  return db.donation.findMany({
    where: { donorId, status: "COMPLETED" },
    include: {
      recipient: { select: { id: true, username: true, imageUrl: true } },
      stream: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

/**
 * Tổng donation revenue của 1 streamer.
 */
export const getStreamerDonationRevenue = async (
  streamerId: string
): Promise<number> => {
  const result = await db.donation.aggregate({
    where: { recipientId: streamerId, status: "COMPLETED" },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
};

/**
 * Đếm donation gần đây trong N phút (cho overlay animation).
 */
export const getRecentDonationCount = async (
  streamerId: string,
  withinMinutes = 60
): Promise<number> => {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000);
  return db.donation.count({
    where: {
      recipientId: streamerId,
      status: "COMPLETED",
      createdAt: { gte: since },
    },
  });
};
