// Minimal service worker — enables PWA install on ChromeOS/Windows/Mac/Linux/Android.
// Network-first (the app needs the live local backend); the shell is cached as a fallback.
const CACHE = "aihub-v1";
const SHELL = ["/", "/static/icon-192.png", "/static/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // never cache API calls — always hit the live backend
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/v1") || url.pathname === "/health") return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request))
  );
});
