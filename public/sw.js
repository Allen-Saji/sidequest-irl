const CACHE = "sidequest-shell-v1";
const ASSETS = [
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/fonts/barlow-condensed-800.ttf",
  "/fonts/dm-sans-400.ttf",
  "/fonts/dm-sans-600.ttf",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("sidequest-shell-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }
  if (ASSETS.includes(url.pathname))
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
});
