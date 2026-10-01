/* eslint-disable no-restricted-globals */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Service Worker for PWA + Push Notifications.
 *
 * Caching strategy:
 *   - Static assets (JS/CSS/images): Stale-While-Revalidate.
 *   - API GET: Network-First with cache fallback.
 *   - Pages: Network-First with offline fallback.
 *
 * Push:
 *   - Listen for push event → show notification with data.
 *   - Notification click → focus or open URL.
 */

// ──────────────────────────────────────────────────────────────────────────
// CACHE NAMES
// ──────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = "v1";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Critical static assets (cached on install).
const PRECACHE_URLS = ["/", "/offline", "/manifest.json"];

// ──────────────────────────────────────────────────────────────────────────
// INSTALL
// ──────────────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ──────────────────────────────────────────────────────────────────────────
// ACTIVATE (cleanup old caches)
// ──────────────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ──────────────────────────────────────────────────────────────────────────
// FETCH (caching strategies)
// ──────────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin.
  if (url.origin !== location.origin) return;

  // Skip non-GET.
  if (request.method !== "GET") return;

  // Pages: Network-First.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // API: Network-First.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: Stale-While-Revalidate.
  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback for pages.
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline");
      if (offlinePage) return offlinePage;
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached || networkPromise;
}

// ──────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS
// ──────────────────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Twitch Clone",
      body: event.data.text(),
    };
  }

  const title = payload.title || "Twitch Clone";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    image: payload.image,
    data: {
      url: payload.url || "/",
      timestamp: Date.now(),
    },
    tag: payload.tag,
    requireInteraction: payload.requireInteraction || false,
    actions: payload.actions || [],
    vibrate: payload.vibrate || [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if same URL.
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        // Open new tab.
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// ──────────────────────────────────────────────────────────────────────────
// BACKGROUND SYNC (placeholder for future)
// ──────────────────────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-events") {
    // Placeholder: re-fetch pending events.
  }
});
