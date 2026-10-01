/**
 * Realtime — in-memory pub/sub cho SSE notifications.
 *
 * MVP: dùng in-memory Map. Production thì dùng Redis Pub/Sub hoặc
 * Cloudflare Durable Objects.
 *
 * Flow:
 *   1. SSE endpoint /api/realtime/notifications mở connection.
 *   2. Server-side map userId → set of SSE controllers.
 *   3. publishNotification(userId, data) ghi vào tất cả controllers.
 *   4. Client nhận được → update UI.
 *
 * Tự cleanup khi controller bị abort.
 */

type NotificationPayload = {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  createdAt: Date | string;
};

const subscriptions = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();

/**
 * Subscribe 1 userId → set of controllers.
 */
export const addSubscription = (
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>
): void => {
  const set = subscriptions.get(userId) ?? new Set();
  set.add(controller);
  subscriptions.set(userId, set);
};

/**
 * Remove 1 controller (gọi khi SSE disconnect).
 */
export const removeSubscription = (
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>
): void => {
  const set = subscriptions.get(userId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) subscriptions.delete(userId);
};

/**
 * Publish 1 notification tới user.
 * Nếu user không connect → no-op.
 */
export const publishNotification = (
  userId: string,
  payload: NotificationPayload
): void => {
  const set = subscriptions.get(userId);
  if (!set || set.size === 0) return;

  const encoder = new TextEncoder();
  const data = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const controller of Array.from(set)) {
    try {
      controller.enqueue(encoder.encode(data));
    } catch (err) {
      // Controller đã bị close → remove.
      set.delete(controller);
      console.warn("[publishNotification] enqueue failed, removing controller");
    }
  }
};

/**
 * Đếm số user đang subscribe (debug).
 */
export const getSubscribedCount = (userId: string): number => {
  return subscriptions.get(userId)?.size ?? 0;
};

/**
 * Tổng số connection (debug).
 */
export const getTotalConnections = (): number => {
  let total = 0;
  for (const set of Array.from(subscriptions.values())) total += set.size;
  return total;
};
