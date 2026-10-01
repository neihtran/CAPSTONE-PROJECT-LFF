/* eslint-disable no-console */

/**
 * Register service worker cho PWA + Push.
 *
 * Called from client layout sau khi user đăng nhập.
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) {
    console.warn("[SW] Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log("[SW] Registered:", registration.scope);

    // Listen for updates.
    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          console.log("[SW] New version available");
        }
      });
    });

    return registration;
  } catch (err) {
    console.error("[SW] Registration failed:", err);
    return null;
  }
}

/**
 * Request notification permission + subscribe to push.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined") return "denied";
  if (!("Notification" in window)) {
    console.warn("[Notifications] Not supported");
    return "denied";
  }

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  const permission = await Notification.requestPermission();
  console.log("[Notifications] Permission:", permission);
  return permission;
}

/**
 * Subscribe to push notifications via service worker.
 * Returns PushSubscription object hoặc null nếu fail.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null;

  const registration = await navigator.serviceWorker.ready;

  // Check if already subscribed.
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) return subscription;

  // Get VAPID key from server.
  try {
    const res = await fetch("/api/push/vapid-key");
    if (!res.ok) throw new Error("Failed to fetch VAPID key");
    const { publicKey } = await res.json();

    // Subscribe.
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Send to server.
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey("p256dh")!),
          auth: arrayBufferToBase64(subscription.getKey("auth")!),
        },
        userAgent: navigator.userAgent,
      }),
    });

    return subscription;
  } catch (err) {
    console.error("[Push] Subscribe failed:", err);
    return null;
  }
}

/**
 * Unsubscribe from push.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;

  const unsubscribed = await subscription.unsubscribe();
  if (unsubscribed) {
    // Notify server.
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  }
  return unsubscribed;
}

// ──────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
