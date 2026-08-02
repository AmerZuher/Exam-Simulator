/* ExamPro — branding: app name, tagline and logo, applied everywhere at once.
 *
 * The logo is stored in one of two forms:
 *   { logoData: "data:image/..." }  an uploaded image, downscaled on the way in
 *   { logoIcon: "grad" }            a built-in mark drawn from the icon set
 * Nothing is stored when the user is on the default mark.
 *
 * Applying branding rewrites the sidebar badge, the document title, the
 * <link rel="icon"> (so the browser tab updates live) and a runtime-generated
 * web app manifest, so an installed PWA picks up the same name and icon.
 */
window.App = window.App || {};

(function () {
  const B = {};

  B.DEFAULT_NAME = "ExamPro";
  B.DEFAULT_TAGLINE = "Study & Simulate";

  const MAX_UPLOAD = 4 * 1024 * 1024;   // 4 MB source cap
  const RASTER_SIZE = 256;              // stored square, plenty for badge + favicon
  const SVG_INLINE_LIMIT = 64 * 1024;   // small SVGs stay vector

  let manifestUrl = null;

  B.name = function () {
    return (App.store.state.settings.appName || "").trim() || B.DEFAULT_NAME;
  };
  B.tagline = function () {
    const t = App.store.state.settings.appTagline;
    return t == null ? B.DEFAULT_TAGLINE : String(t).trim();
  };
  B.logoData = function () { return App.store.state.settings.logoData || null; };
  B.logoIcon = function () { return App.store.state.settings.logoIcon || "logo"; };
  B.isCustom = function () {
    const s = App.store.state.settings;
    return !!(s.logoData || (s.logoIcon && s.logoIcon !== "logo"));
  };

  /* ---------------- mark rendering ---------------- */

  /* The badge shown in the sidebar and the settings preview. */
  B.markHtml = function (size) {
    size = size || 20;
    const data = B.logoData();
    if (data) {
      return '<img class="brand-img" src="' + App.u.esc(data) + '" alt="" draggable="false" style="width:100%;height:100%">';
    }
    return App.icon(B.logoIcon(), size, 2);
  };

  function accentHex() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--acc").trim();
    return v || "#6366f1";
  }

  /* A standalone SVG favicon: accent rounded square + the built-in mark. */
  function iconFaviconUri() {
    const inner = App.icon(B.logoIcon(), 24, 2)
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, "");
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<rect width="24" height="24" rx="5.5" fill="' + accentHex() + '"/>' +
      '<g transform="translate(3.7 3.7) scale(0.692)" fill="none" color="#ffffff" stroke="#ffffff" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + inner + "</g></svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  B.faviconUri = function () {
    return B.logoData() || iconFaviconUri();
  };

  /* ---------------- upload handling ---------------- */

  /* Thin wrapper over the shared App.u.readImageFile (see UI-KIT.md) — kept
     as B.readLogoFile so existing call sites don't need to change. */
  B.readLogoFile = function (file, done, fail) {
    App.u.readImageFile(file, { maxBytes: MAX_UPLOAD, size: RASTER_SIZE, svgInlineLimit: SVG_INLINE_LIMIT }, done, fail);
  };

  /* ---------------- applying ---------------- */

  B.setLogoData = function (dataUri) {
    App.store.setSetting("logoData", dataUri || null);
    if (dataUri) App.store.setSetting("logoIcon", null);
    B.apply();
  };
  B.setLogoIcon = function (iconName) {
    App.store.setSetting("logoIcon", iconName || null);
    App.store.setSetting("logoData", null);
    B.apply();
  };
  B.reset = function () {
    App.store.setSetting("appName", null);
    App.store.setSetting("appTagline", null);
    App.store.setSetting("logoData", null);
    App.store.setSetting("logoIcon", null);
    B.apply();
  };

  function setFavicon(href) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    /* some browsers only repaint the tab when the element is replaced */
    const fresh = link.cloneNode(false);
    fresh.setAttribute("href", href);
    link.parentNode.replaceChild(fresh, link);

    let apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (!apple) {
      apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      document.head.appendChild(apple);
    }
    apple.setAttribute("href", href);
  }

  /* Swap in a manifest built from the current branding, so an installed PWA
     shows the user's own name and icon. */
  function setManifest() {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link || typeof Blob === "undefined" || !URL.createObjectURL) return;
    const name = B.name();
    const manifest = {
      name: name + (B.tagline() ? " — " + B.tagline() : ""),
      short_name: name,
      description: "Import question banks, run timed exam simulations, and study with spaced repetition.",
      start_url: "index.html",
      display: "standalone",
      orientation: "any",
      background_color: document.body.dataset.theme === "dark" ? "#080c1a" : "#f4f6fb",
      theme_color: accentHex(),
      icons: [{ src: B.faviconUri(), sizes: "any", type: B.logoData() ? "image/png" : "image/svg+xml", purpose: "any" }]
    };
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
      if (manifestUrl) URL.revokeObjectURL(manifestUrl);
      manifestUrl = url;
      link.setAttribute("href", url);
    } catch (e) { /* manifest stays as shipped */ }
  }

  B.apply = function () {
    const name = B.name();
    const tagline = B.tagline();

    const badge = document.getElementById("brand-ico");
    const badgeBox = document.getElementById("brand-btn");
    if (badge) badge.innerHTML = B.markHtml(20);
    /* the badge's actual box (background, circular clip) lives on the
       button wrapping #brand-ico, not on #brand-ico itself — the toggle
       has to land there or none of the has-img styling ever applies. */
    if (badgeBox) badgeBox.classList.toggle("has-img", !!B.logoData());
    const nameEl = document.querySelector(".brand-name");
    if (nameEl) nameEl.textContent = name;
    const subEl = document.querySelector(".brand-sub");
    if (subEl) {
      subEl.textContent = tagline;
      subEl.style.display = tagline ? "" : "none";
    }

    document.title = name + (tagline ? " — " + tagline : "");
    setFavicon(B.faviconUri());
    setManifest();
  };

  App.branding = B;
})();
