// Copia locale dell'app per aprirla subito (anche senza rete). Gli aggiornamenti si installano
// dal pulsante «Aggiorna» dell'app, che svuota questa copia e ricarica.
const CACHE = "cashflow-app";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith("version.json")) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    const r = await fetch(e.request, { cache: "no-cache" });
    if (r.ok) cache.put(e.request, r.clone());
    return r;
  })());
});
