/**
 * Push Notification Service — server-side.
 *
 * Gửi Web Push tới user devices khi:
 *   - Streamer bắt đầu live.
 *   - Nhận donation/sub mới.
 *   - Được mention trong chat.
 *   - Event goal completed.
 *
 * Sử dụng web-push library với VAPID keys.
 */

import webpush from "web-push";
import { db } from "@/lib/db";

// ──────────────────────────────────────────────────────────────────────────
// VAPID KEYS (from .env)
// ──────────────────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@twitch-clone.local";

let vapidConfigured = false;
const configureVapid = () => {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] VAPID keys not configured; push disabled");
    return false;
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.error("[push] VAPID config error:", err);
    return false;
  }
};

// ──────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────

export type NotificationPayload = {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
  data?: Record<string, unknown>;
};

export type PushPreferences = {
  liveNotifications: boolean;
  donationAlerts: boolean;
  chatMentions: boolean;
  eventUpdates: boolean;
};

// Default preferences.
export const DEFAULT_PREFERENCES: PushPreferences = {
  liveNotifications: true,
  donationAlerts: true,
  chatMentions: true,
  eventUpdates: false,
};

// ──────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION MANAGEMENT
// ──────────────────────────────────────────────────────────────────────────

export const saveSubscription = async (params: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) => {
  // Upsert (endpoint unique).
  const existing = await db.pushSubscription.findUnique({
    where: { endpoint: params.endpoint },
  });

  if (existing) {
    return db.pushSubscription.update({
      where: { id: existing.id },
      data: {
        userId: params.userId,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent,
      },
    });
  }

  return db.pushSubscription.create({
    data: {
      userId: params.userId,
      endpoint: params.endpoint,
      p256dh: params.p256dh,
      auth: params.auth,
      userAgent: params.userAgent,
      preferences: DEFAULT_PREFERENCES as never,
    },
  });
};

export const removeSubscription = async (endpoint: string) => {
  try {
    await db.pushSubscription.delete({ where: { endpoint } });
    return true;
  } catch {
    return false;
  }
};

export const updatePreferences = async (
  endpoint: string,
  prefs: PushPreferences
) => {
  return db.pushSubscription.update({
    where: { endpoint },
    data: { preferences: prefs as never },
  });
};

// ──────────────────────────────────────────────────────────────────────────
// SENDING NOTIFICATIONS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Send notification tới 1 subscription cụ thể.
 * Tự động remove subscription nếu endpoint không hợp lệ (410 Gone).
 */
export const sendNotification = async (
  subscription: {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    preferences: unknown;
  },
  payload: NotificationPayload
): Promise<{ sent: boolean; reason?: string }> => {
  if (!configureVapid()) {
    return { sent: false, reason: "vapid-not-configured" };
  }

  // Check preferences.
  const prefs =
    (subscription.preferences as PushPreferences) ?? DEFAULT_PREFERENCES;
  if (payload.tag && !prefs.liveNotifications) {
    return { sent: false, reason: "preference-disabled" };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    );
    return { sent: true };
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      // Subscription expired → remove.
      console.log(`[push] Removing dead subscription ${subscription.id}`);
      await db.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
      return { sent: false, reason: "expired" };
    }
    console.error(`[push] Send error (${status}):`, err);
    return { sent: false, reason: "send-error" };
  }
};

/**
 * Broadcast notification tới tất cả subscriptions của 1 user.
 */
export const notifyUser = async (
  userId: string,
  payload: NotificationPayload
) => {
  const subs = await db.pushSubscription.findMany({
    where: { userId },
  });

  const results = await Promise.all(
    subs.map((sub) => sendNotification(sub, payload))
  );

  return {
    total: subs.length,
    sent: results.filter((r) => r.sent).length,
    failed: results.filter((r) => !r.sent).length,
  };
};

/**
 * Broadcast tới tất cả followers của 1 streamer (khi bắt đầu live).
 */
export const notifyStreamerLive = async (streamerId: string) => {
  const followers = await db.follow.findMany({
    where: { followingId: streamerId },
    select: { followerId: true },
  });

  const followerIds = followers.map((f) => f.followerId);
  const subs = await db.pushSubscription.findMany({
    where: {
      userId: { in: followerIds },
    },
  });

  const payload: NotificationPayload = {
    title: "🔴 Đang LIVE!",
    body: "Streamer bạn follow vừa bắt đầu livestream",
    icon: "/icon-192.png",
    url: "/",
    tag: "live-notification",
    requireInteraction: true,
    actions: [
      { action: "watch", title: "Xem ngay" },
    ],
  };

  const results = await Promise.all(
    subs.map((sub) => sendNotification(sub, payload))
  );

  return {
    total: subs.length,
    sent: results.filter((r) => r.sent).length,
  };
};

/**
 * Notify 1 user khi nhận donation mới (cho streamer).
 */
export const notifyDonation = async (params: {
  streamerId: string;
  donorUsername: string;
  amountCents: number;
  message?: string;
}) => {
  const formattedAmount = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(params.amountCents);

  const payload: NotificationPayload = {
    title: `💰 Donation từ ${params.donorUsername}`,
    body: params.message
      ? `${params.message} - ${formattedAmount}`
      : `Bạn vừa nhận ${formattedAmount}`,
    icon: "/icon-192.png",
    url: "/dashboard",
    tag: "donation-alert",
  };

  return notifyUser(params.streamerId, payload);
};

// ──────────────────────────────────────────────────────────────────────────
// VAPID KEY GENERATION (run once to get keys)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Generate VAPID keys. Run this script ONCE to get keys for .env:
 *
 *   npx tsx -e "require('./lib/push-service').generateVapidKeys()"
 *
 * Or use web-push CLI:
 *   npx web-push generate-vapid-keys
 */
export const generateVapidKeys = () => {
  const keys = webpush.generateVAPIDKeys();
  console.log("VAPID Public Key:", keys.publicKey);
  console.log("VAPID Private Key:", keys.privateKey);
  console.log("\nAdd to .env:");
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
  return keys;
};
