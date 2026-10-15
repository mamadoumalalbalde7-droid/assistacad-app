// AssistAcad (partage v1) — l'application s'ouvre même sans réseau (écran « hors connexion »)
const CACHE = "assistacad-480f4d8b";
const COQUILLE = ["./", "index.html", "manifest.webmanifest", "icone-192.png?v=480f4d8b", "icone-512.png?v=480f4d8b", "apple-touch-icon.png?v=480f4d8b", "favicon.ico"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== "GET") return;     // le contenu AssistAcad vient toujours en direct
  if (u.pathname.endsWith("config.json") || u.pathname.endsWith("nouveautes.json")) { e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request))); return; }
  const frais = e.request.mode === "navigate" || /\/(index\.html|manifest\.webmanifest)?$/.test(u.pathname) || u.pathname.endsWith(".webmanifest");
  if (frais) { e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }))); return; }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

self.addEventListener("message", (e) => { if (e.data === "maj") self.skipWaiting(); });

// Notifications : affichage à la réception et ouverture au clic
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { try { d = { corps: e.data.text() }; } catch (y) {} }
  const titre = d.titre || "AssistAcad";
  const opt = {
    body: d.corps || "", icon: d.icone || "icone-192.png", badge: "icone-192.png",
    lang: d.langue || "fr", dir: d.langue === "ar" ? "rtl" : "auto",
    data: { url: d.url || "./" }, tag: d.tag || "assistacad", renotify: true, vibrate: [60, 30, 60]
  };
  e.waitUntil(self.registration.showNotification(titre, opt));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const cible = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((liste) => {
    for (const c of liste) { if ("focus" in c) { c.navigate && c.navigate(cible); return c.focus(); } }
    return clients.openWindow(cible);
  }));
});
