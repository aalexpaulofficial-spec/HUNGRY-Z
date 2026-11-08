const CACHE_PREFIX = "hungry-public-";
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest-student.webmanifest",
  "/manifest-canteen.webmanifest",
  "/pwa-install-capture.js",
  "/HUNGRY%20Z%20Q%20LOGO.png",
  "/HUNGRY%20Z%20CANTEEN%20DAHSBOARD%20LOGO.png",
  "/Red%20Social%20Media%20Icons%20Trio.png",
  "/icons/canteen-192.png",
  "/icons/canteen-512.png",
  "/icons/student-192.png",
  "/icons/student-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(?:api|_server|_serverFn|server-fn)(?:\/|$)/i.test(url.pathname)) return;

  if (request.mode === "navigate") {
    // Cache only the static client-rendered canteen shell so an installed owner app
    // can start offline. Authenticated app HTML and all server data stay network-only.
    if (url.pathname === "/canteen") {
      event.respondWith((async () => {
        try {
          const response = await fetch(request);
          if (response.ok && response.type === "basic") {
            const cache = await caches.open(CACHE_NAME);
            await cache.put("/canteen", response.clone());
          }
          return response;
        } catch {
          return (await caches.match("/canteen")) || (await caches.match("/offline.html")) || Response.error();
        }
      })());
      return;
    }
    event.respondWith(fetch(request).catch(async () => {
      const offline = await caches.match("/offline.html");
      return offline || Response.error();
    }));
    return;
  }

  // Cache only public static assets. Auth, API/server-function and other dynamic
  // responses have no asset destination/extension and are deliberately excluded.
  const isStaticAsset = ["script", "style", "image", "font"].includes(request.destination) ||
    /\.(?:js|css|png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request);
      return cached || Response.error();
    }
  })());
});
