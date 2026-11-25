// Service worker for Betongrehab offline. Appen caches seg selv; lyd lagres når du trykker «Last ned alt».
const APP = "app-v38d23804", LYD = "lyd-df2c6770", FONT = "font-v1";
const SKALL = ["./", "index.html", "manifest.webmanifest", "ikon-192.png", "ikon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(APP).then(c => c.addAll(SKALL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith("app-") && k !== APP) || (k.startsWith("lyd-") && k !== LYD)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

async function delvis(resp, range) {
  const blob = await resp.blob(), n = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(range || "");
  let a = m && m[1] !== "" ? +m[1] : 0, b = m && m[2] !== "" ? +m[2] : n - 1;
  if (m && m[1] === "" && m[2] !== "") { a = Math.max(0, n - +m[2]); b = n - 1; }
  b = Math.min(b, n - 1);
  if (a >= n) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${n}` } });
  return new Response(blob.slice(a, b + 1, "audio/mpeg"), { status: 206, headers: {
    "Content-Type": "audio/mpeg", "Content-Range": `bytes ${a}-${b}/${n}`, "Content-Length": String(b - a + 1), "Accept-Ranges": "bytes" } });
}

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.includes("/lyd/")) {
    e.respondWith((async () => {
      const c = await caches.open(LYD), hit = await c.match(url.origin + url.pathname);
      if (hit) return url.pathname.endsWith(".mp3") ? delvis(hit, req.headers.get("range")) : hit;
      return fetch(req);
    })());
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONT).then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin === location.origin) {
    // appen: hent nyeste når det er nett (maks 4 s), ellers lagret versjon
    e.respondWith(caches.open(APP).then(async c => {
      const key = req.mode === "navigate" ? "index.html" : req;
      const nett = fetch(req, { cache: "no-cache" }).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
      const hit = await c.match(key, { ignoreSearch: true });
      if (!hit) return (await nett) || new Response("Offline", { status: 503 });
      return (await Promise.race([nett, new Promise(r => setTimeout(() => r(null), 4000))])) || hit;
    }));
  }
});
