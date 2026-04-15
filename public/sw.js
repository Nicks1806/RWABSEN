// RedWine Attendance - Service Worker
// Cache static assets for offline availability

const CACHE_NAME = "redwine-v1";
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
