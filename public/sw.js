// RedWine Attendance - Service Worker
// Cache static assets + push notifications + auto-update support

const CACHE_NAME = "redwine-v9";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon.png",
  "/apple-icon.png",
  "/logo.png",
];

// Install - cache static assets, skip waiting so new SW activates immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean old caches + claim all clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Listen for SKIP_WAITING message from client (manual update trigger)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Push event - show notification
self.addEventListener("push", (event) => {
  let data = { title: "RedWine", body: "Notifikasi baru", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
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

// Click notification - open/focus app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Fetch - network first for HTML (always fresh), cache first for static assets
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Don't cache Supabase API
  if (url.hostname.includes("supabase.co")) return;

  // Don't cache Next.js content-hashed chunks (hash changes per build,
  // caching leads to stale references → "Failed to load chunk" errors).
  // Always fetch fresh from server; browser has own HTTP cache.
  if (url.pathname.includes("/_next/static/chunks/") || url.pathname.includes("/_next/static/css/")) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Network-first for HTML navigation (always fresh to avoid stale chunk refs)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Cache first for static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Revalidate in background
        fetch(req)
          .then((res) => {
            if (res.ok && res.type === "basic") {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, res));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});
