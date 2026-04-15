// RedWine Attendance - Service Worker
// Cache static assets for offline availability + push notifications

const CACHE_NAME = "redwine-v2";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon.png",
  "/apple-icon.png",
  "/logo.png",
];

// Install - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Push event - show notification
self.addEventListener("push", (event) => {
  let data = { title: "RedWine", body: "Notifikasi baru", url: "/" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    data.body = event.data?.text() || data.body;
  }

  const options = {
    body: data.body,
    icon: "/icon.png",
    badge: "/icon.png",
    data: { url: data.url || "/" },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: "redwine-notif",
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Click notification - open app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If app already open, focus it
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Fetch - network first, cache fallback for static GET
self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only cache GET
  if (req.method !== "GET") return;

  // Don't cache Supabase API calls or realtime WebSockets
  const url = new URL(req.url);
  if (url.hostname.includes("supabase.co")) return;

  // Network first for HTML navigation (always fresh)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Cache first for static assets (images, js, css)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache successful responses
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});
