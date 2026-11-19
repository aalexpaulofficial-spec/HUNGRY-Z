const CACHE_PREFIX = "hungry-public-";
const CACHE_NAME = `${CACHE_PREFIX}v25`;
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest-student.webmanifest",
  "/manifest-canteen.webmanifest",
  "/pwa-install-capture.js",
  "/HUNGRY%20Z%20Q%20LOGO.png",
  "/HUNGRY%20Z%20CANTEEN%20DAHSBOARD%20LOGO.png",
  "/social-instagram-email.png?v=3",
  "/social-whatsapp-email.png?v=3",
  "/social-linkedin-email.png?v=3",
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

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let message = {};
    try { message = event.data?.json() ?? {}; }
    catch { message = { body: event.data?.text() ?? "" }; }
    const title = typeof message.title === "string" ? message.title : "HUNGRY Z";
    const options = {
      body: typeof message.body === "string" ? message.body : "You have a new update.",
      icon: "/icons/student-192.png",
      badge: "/icons/student-192.png",
      tag: typeof message.notificationId === "string" ? `hz-${message.notificationId}` : "hz-notification",
      renotify: false,
      data: { href: typeof message.href === "string" ? message.href : "/app" },
    };
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const foreground = windows.find((client) => client.visibilityState === "visible");
    if (foreground) {
      foreground.postMessage({ type: "HUNGRYZ_PUSH", notification: message });
      return;
    }
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.href;
  let target = new URL("/app", self.location.origin);
  if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) {
    const candidate = new URL(path, self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const subscription = event.newSubscription?.toJSON() ?? null;
    for (const client of windows) client.postMessage({ type: "HUNGRYZ_PUSH_SUBSCRIPTION_CHANGED", subscription });
  }));
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
