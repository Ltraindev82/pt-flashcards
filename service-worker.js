/* service-worker.js
 * Portuguese Flashcards — PWA cache & offline support
 * Update CACHE_VERSION when you ship changes to force a refresh.
 */

const CACHE_VERSION = "v3";
const CACHE_NAME = `pt-flashcards-${CACHE_VERSION}`;

// List everything your app needs to run offline.
// Add any extra files you reference (images, sounds, stylesheets, etc.).
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./pt-flashcards-247.json",  // remove this line if you don't serve the JSON
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-apple.png"
];

/* Install: pre-cache the “app shell” so it works offline after first load */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting(); // activate the new SW immediately after install
});

/* Activate: clean up old caches when you bump CACHE_VERSION */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith("pt-flashcards-")) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

/* Fetch strategy:
 * - HTML pages: network-first (so updates ship fast), fallback to cache when offline
 * - JSON deck: network-first (so content updates), fallback to cache when offline
 * - Other static assets (icons, manifest, etc.): cache-first for speed
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests from same origin
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) {
    return;
  }

  // HTML pages (navigation requests)
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // JSON (deck or other data)
  if (req.destination === "document" || req.headers.get("accept")?.includes("application/json") || req.url.endsWith(".json")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Everything else (icons, manifest, images, etc.) — cache-first
  event.respondWith(cacheFirst(req));
});

/* Helpers */

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // As a last resort, serve the app shell for navigations
    if (request.mode === "navigate") {
      return cache.match("./index.html");
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, fresh.clone());
  return fresh;
}
