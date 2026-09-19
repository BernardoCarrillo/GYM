/* =========================================================================
   GymLog — Service Worker (estrategia cache-first)
   Cachea la app (HTML) y Chart.js para que todo funcione sin conexión.
   ========================================================================= */
const CACHE = "gymlog-v10";

// Recursos base a precachear. Se incluyen variantes del nombre del HTML
// para cubrir instalaciones como index.html o gym.html.
const ASSETS = [
  "./",
  "./index.html",
  "./gym.html",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
];

// Instalación: precachea lo que esté disponible (sin fallar si alguno no existe).
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(ASSETS.map((u) => cache.add(u)))
    ).then(() => self.skipWaiting())
  );
});

// Activación: limpia caches antiguas.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first. Si está en cache se sirve; si no, se va a la red y se guarda.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          if (e.request.mode === "navigate") {
            return caches.match("./index.html")
              .then((r) => r || caches.match("./gym.html"))
              .then((r) => r || caches.match("./"));
          }
        });
    })
  );
});
