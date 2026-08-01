const CACHE = "exampro-v5";
const URLS = [
  "index.html",
  "manifest.json",
  "app/css/app.css",
  "app/js/icons.js",
  "app/js/utils.js",
  "app/js/store.js",
  "app/js/srs.js",
  "app/js/parser.js",
  "app/js/ui.js",
  "app/js/branding.js",
  "app/js/charts.js",
  "app/js/palette.js",
  "app/js/views/dashboard.js",
  "app/js/views/importer.js",
  "app/js/views/study.js",
  "app/js/views/review.js",
  "app/js/views/exam.js",
  "app/js/views/results.js",
  "app/js/views/progress.js",
  "app/js/views/settings.js",
  "app/js/router.js",
  "app/js/main.js"
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