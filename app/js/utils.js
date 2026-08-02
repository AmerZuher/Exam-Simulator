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

  /* Reads a user-picked image into a storable data URI — shared by the app
     branding picker and any per-bank logo picker so both get the same
     validation and don't blow up localStorage. Small SVGs stay vector;
     everything else is drawn onto a square canvas (cover-cropped, no
     letterboxing) so the stored size stays small and predictable. */
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
          const scale = Math.max(size / img.width, size / img.height);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
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
