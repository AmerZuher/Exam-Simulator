/* ExamPro — small shared utilities */
window.App = window.App || {};

(function () {
  const U = {};

  /* HTML-escape a value for safe interpolation into templates */
  U.esc = function (v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  /* Escape a string for safe use inside a single-quoted JS handler attribute */
  U.jsq = function (v) {
    return String(v == null ? "" : v).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  };

  U.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  U.clamp = function (n, min, max) { return Math.max(min, Math.min(max, n)); };

  U.pad2 = function (n) { return String(n).padStart(2, "0"); };

  U.fmtClock = function (secs) {
    secs = Math.max(0, secs | 0);
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return U.pad2(h) + ":" + U.pad2(m) + ":" + U.pad2(s);
  };

  U.fmtDuration = function (secs) {
    secs = Math.max(0, secs | 0);
    if (secs < 60) return secs + "s";
    const h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60);
    if (h > 0) return h + "h " + m + "m";
    return m + "m " + (secs % 60) + "s";
  };

  U.fmtDate = function (ts) {
    try {
      return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch (e) { return ""; }
  };

  U.debounce = function (fn, ms) {
    let t = null;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  U.throttle = function (fn, ms) {
    let last = 0, timer = null;
    return function () {
      const now = Date.now(), args = arguments, self = this;
      if (now - last >= ms) { last = now; fn.apply(self, args); }
      else if (!timer) {
        timer = setTimeout(function () { last = Date.now(); timer = null; fn.apply(self, args); }, ms - (now - last));
      }
    };
  };

  /* Animated number count-up */
  U.countUp = function (el, to, opts) {
    opts = opts || {};
    const dur = opts.duration || 900;
    const suffix = opts.suffix || "";
    const decimals = opts.decimals || 0;
    const start = performance.now();
    function frame(now) {
      const p = U.clamp((now - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* Wrap occurrences of `term` in <mark> (input already HTML-escaped first) */
  U.highlight = function (rawText, term) {
    const safe = U.esc(rawText);
    if (!term) return safe;
    const t = term.trim();
    if (!t) return safe;
    const rx = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return safe.replace(rx, "<mark>$1</mark>");
  };

  /* Trigger a client-side file download */
  U.download = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 60);
  };

  /* A link's site icon, derived straight from its URL — no HTML fetch/scrape
     needed (and none would work cross-origin from a static client-side app
     anyway). Google's favicon service returns the right mark for any domain
     — YouTube for a youtube.com link, GitHub for github.com, etc. — from an
     <img> tag, which loads cross-origin fine without CORS. */
  U.faviconUrl = function (url, size) {
    try {
      const host = new URL(url).hostname;
      return "https://www.google.com/s2/favicons?sz=" + (size || 32) + "&domain=" + encodeURIComponent(host);
    } catch (e) { return null; }
  };

  U.slugFile = function (name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "exam-bank";
  };

  /* Event delegation helper */
  U.on = function (root, evt, selector, handler) {
    root.addEventListener(evt, function (e) {
      const t = e.target.closest(selector);
      if (t && root.contains(t)) handler(e, t);
    });
  };

  /* Some exported images (app-icon-style PNGs especially) carry transparent
     padding around the real artwork. Left alone, that padding survives
     every later crop untouched — object-fit only ever crops an image's
     rectangular *bounds*, never what's transparent inside them — and shows
     through as an empty ring wherever the image is displayed on a colour.
     Scan a downscaled copy for the bounding box of non-transparent pixels
     so the caller can crop to the real artwork instead. Returns null if
     the image has no meaningful transparent margin (nothing to trim) or
     can't be read (e.g. a tainted canvas). */
  function opaqueBounds(img) {
    const MAX_SCAN = 300;                 // downscaled purely for a fast pixel scan
    const scale = Math.min(1, MAX_SCAN / Math.max(img.width, img.height));
    const sw = Math.max(1, Math.round(img.width * scale));
    const sh = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas");
    c.width = sw; c.height = sh;
    const cx = c.getContext("2d");
    if (!cx) return null;
    cx.drawImage(img, 0, 0, sw, sh);
    let data;
    try { data = cx.getImageData(0, 0, sw, sh).data; } catch (e) { return null; }

    const ALPHA_THRESHOLD = 10;
    let minX = sw, minY = sh, maxX = -1, maxY = -1;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (data[(y * sw + x) * 4 + 3] > ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;            // fully transparent — nothing to crop to

    const back = 1 / scale;
    const x = Math.floor(minX * back), y = Math.floor(minY * back);
    const w = Math.min(img.width - x, Math.ceil((maxX - minX + 1) * back));
    const h = Math.min(img.height - y, Math.ceil((maxY - minY + 1) * back));
    /* a barely-smaller box is just anti-aliasing fuzz at the true edges,
       not real padding — only trim when it actually buys something */
    if (w > img.width * 0.98 && h > img.height * 0.98) return null;
    return { x: x, y: y, w: w, h: h };
  }

  /* Reads a user-picked image into a storable data URI — shared by the app
     branding picker and any per-bank logo picker so both get the same
     validation and don't blow up localStorage. Small SVGs stay vector;
     everything else is trimmed to its opaque content (see opaqueBounds)
     and drawn onto a square canvas (cover-cropped, no letterboxing) so the
     stored size stays small and predictable. */
  U.readImageFile = function (file, opts, done, fail) {
    opts = opts || {};
    const maxBytes = opts.maxBytes || 4 * 1024 * 1024;
    const size = opts.size || 256;
    const svgInlineLimit = opts.svgInlineLimit || 64 * 1024;

    if (!file) return fail("No file selected.");
    if (!/^image\//.test(file.type)) return fail("That file isn't an image.");
    if (file.size > maxBytes) return fail("Image is larger than " + Math.round(maxBytes / (1024 * 1024)) + " MB — try a smaller one.");

    const reader = new FileReader();
    reader.onerror = function () { fail("Could not read that file."); };

    if (file.type === "image/svg+xml" && file.size <= svgInlineLimit) {
      reader.onload = function () { done("data:image/svg+xml," + encodeURIComponent(String(reader.result))); };
      reader.readAsText(file);
      return;
    }

    reader.onload = function () {
      const img = new Image();
      img.onerror = function () { fail("That image could not be decoded."); };
      img.onload = function () {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return done(String(reader.result));
          const rect = opaqueBounds(img) || { x: 0, y: 0, w: img.width, h: img.height };
          const scale = Math.max(size / rect.w, size / rect.h);
          const w = Math.round(rect.w * scale);
          const h = Math.round(rect.h * scale);
          ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, (size - w) / 2, (size - h) / 2, w, h);
          done(canvas.toDataURL("image/png"));
        } catch (e) {
          fail("Could not process that image.");
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  App.u = U;
})();
