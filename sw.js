// Copia locale dell'app per aprirla anche senza rete.
// Con la rete si prende sempre la versione nuova dei file (così gli aggiornamenti arrivano subito);
// la copia locale si usa solo se la rete non risponde entro pochi secondi.
const CACHE = "cashflow-app";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("lenta")), ms)); }

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith("version.json")) return;
  if (url.pathname.includes("/icons/")) return;     // le icone le prende iPhone direttamente
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const r = await Promise.race([fetch(e.request, { cache: "no-cache" }), timeout(4000)]);
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch {
      const hit = await cache.match(e.request, { ignoreSearch: true })
        || (e.request.mode === "navigate" ? await cache.match("./") : null);
      return hit || fetch(e.request);
    }
  })());
});
