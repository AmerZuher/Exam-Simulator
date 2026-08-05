const CACHE = "exampro-v7";
// The React build emits content-hashed bundle filenames that change every
// build, so they can't be precached by name here — the fetch handler below
// caches them opportunistically as they're requested instead.
const URLS = [
  "/",
  "/index.html",
  "/manifest.json"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(URLS); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches["delete"](k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  // Only GET requests over http(s) are cacheable — anything else (the
  // Supabase API's POST/PATCH/DELETE mutations, browser-extension requests,
  // etc.) must pass straight through untouched or Cache.put() throws.
  if (e.request.method !== "GET" || !/^https?:/.test(e.request.url)) return;

  e.respondWith(
    fetch(e.request).then(function (res) {
      var clone = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
      return res;
    })["catch"](function () {
      return caches.match(e.request).then(function (hit) { return hit || caches.match("index.html"); });
    })
  );
});