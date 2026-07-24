const CACHE = "sipeka-static-v3";
const STATIC = [
  "/offline.html",
  "/manifest.webmanifest",
  "/assets/smansa-logo.webp",
  "/assets/icons/favicon-32.png",
  "/assets/icons/apple-touch-icon.png",
  "/assets/icons/sipeka-192.png",
  "/assets/icons/sipeka-512.png",
  "/assets/icons/sipeka-maskable-192.png",
  "/assets/icons/sipeka-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("sipeka-") && key !== CACHE).map(caches.delete),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || STATIC.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
  }
});
