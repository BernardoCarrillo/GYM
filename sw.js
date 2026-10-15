/* =========================================================================
   GymLog — Service Worker
   - HTML (navegación): RED PRIMERO con tiempo límite y respaldo en caché.
     Antes era cache-first también para el HTML: una vez instalada, la app
     servía siempre la versión vieja y las correcciones nunca llegaban al
     iPhone. Ahora, con conexión, se carga la última versión; sin conexión
     (o si la red tarda más de 3.5 s) se usa la copia guardada.
   - Resto (Chart.js, etc.): cache-first, como antes.
   Sube el número de CACHE cada vez que publiques cambios.
   ========================================================================= */
const CACHE = "gymlog-v12";

// Variantes del nombre del HTML para cubrir index.html o gym.html.
const ASSETS = [
  "./",
  "./index.html",
  "./gym.html",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
];

// Instalación: precachea lo disponible (sin fallar si alguno no existe).
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(ASSETS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

// Activación: limpia caches antiguas y toma control de inmediato.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function guardarEnCache(req, res) {
  if (res && res.ok) {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
  }
}

function htmlDesdeCache(req) {
  return caches.match(req, { ignoreSearch: true })
    .then((r) => r || caches.match("./index.html"))
    .then((r) => r || caches.match("./gym.html"))
    .then((r) => r || caches.match("./"));
}

// Red primero para el HTML; si tarda o falla, copia en caché.
function redPrimero(req) {
  return new Promise((resolve) => {
    let resuelto = false;
    const responder = (r) => { if (!resuelto && r) { resuelto = true; resolve(r); } };
    const temporizador = setTimeout(() => { htmlDesdeCache(req).then(responder); }, 3500);
    fetch(req)
      .then((res) => { clearTimeout(temporizador); guardarEnCache(req, res); responder(res); })
      .catch(() => {
        clearTimeout(temporizador);
        htmlDesdeCache(req).then((r) => responder(r || Response.error()));
      });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith("http")) return;

  if (req.mode === "navigate") {
    e.respondWith(redPrimero(req));
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => { guardarEnCache(req, res); return res; })
        .catch(() => Response.error());
    })
  );
});
