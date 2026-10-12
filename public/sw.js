const SW_VERSION = "6";
const SHELL_CACHE = `family-task-shell-${SW_VERSION}`;
const STATIC_CACHE = `family-task-static-${SW_VERSION}`;
const DEFAULT_NOTIFICATION_ICON = "/icon-192x192.png?v=3";
const ICON_TIMEOUT_MS = 3000;

async function loadNotificationIcon(icon, signal) {
  const response = await fetch(icon, { signal, credentials: "omit", redirect: "error" });
  if (!response.ok) throw new Error("Icon unavailable");
  const blob = await response.blob();
  if (!/^image\/(png|jpeg|webp)$/.test(blob.type) || blob.size > 2 * 1024 * 1024) {
    throw new Error("Invalid icon");
  }
  // Reject corrupt images too. showNotification can silently ignore a broken icon.
  const bitmap = await createImageBitmap(blob);
  bitmap.close();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  // Service workers have no URL.createObjectURL. A data URL also avoids a
  // second network request when the browser constructs the notification.
  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function resolveNotificationIcon(icon) {
  if (typeof icon !== "string" || icon === DEFAULT_NOTIFICATION_ICON) return DEFAULT_NOTIFICATION_ICON;
  try {
    const url = new URL(icon, self.location.origin);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && self.location.protocol === "http:")) {
      return DEFAULT_NOTIFICATION_ICON;
    }
    if (url.username || url.password) return DEFAULT_NOTIFICATION_ICON;
  } catch {
    return DEFAULT_NOTIFICATION_ICON;
  }
  const controller = new AbortController();
  let timeout;
  try {
    return await Promise.race([
      loadNotificationIcon(icon, controller.signal),
      new Promise((resolve) => {
        timeout = setTimeout(() => {
          controller.abort();
          resolve(DEFAULT_NOTIFICATION_ICON);
        }, ICON_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return DEFAULT_NOTIFICATION_ICON;
  } finally {
    clearTimeout(timeout);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add("/offline.html"))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("family-task-") && key !== SHELL_CACHE && key !== STATIC_CACHE)
        .map((key) => caches.delete(key))
    )).then(() => clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_HOME") return;
  event.waitUntil(
    fetch("/", { credentials: "include" }).then((response) => {
      if (!response.ok || response.redirected) return;
      return caches.open(SHELL_CACHE).then((cache) => cache.put("/", response));
    }).catch(() => {})
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "家族タスク";
  const options = {
    body: data.body || "",
    icon: DEFAULT_NOTIFICATION_ICON,
    badge: "/icon-badge.png?v=3",
    data: {
      url: data.url || "/",
    },
  };
  event.waitUntil((async () => {
    options.icon = await resolveNotificationIcon(data.icon);
    try {
      await self.registration.showNotification(title, options);
    } catch (error) {
      if (options.icon === DEFAULT_NOTIFICATION_ICON) throw error;
      await self.registration.showNotification(title, { ...options, icon: DEFAULT_NOTIFICATION_ICON });
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        // The home document is static app shell; household data is fetched by
        // the client and remains in its user-scoped query cache.
        if (url.pathname === "/" && response.ok && !response.redirected) {
          event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put("/", response.clone())));
        }
        return response;
      }).catch(async () => {
        if (url.pathname === "/") {
          const home = await caches.match("/");
          if (home) return home;
        }
        return (await caches.match("/offline.html")) || Response.error();
      })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|webp|jpg|jpeg)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone())));
        }
        return response;
      }))
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/";
  // Only allow relative paths starting with / (prevent open redirect)
  const url = typeof rawUrl === "string" && rawUrl.startsWith("/") && !rawUrl.startsWith("//") ? rawUrl : "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
