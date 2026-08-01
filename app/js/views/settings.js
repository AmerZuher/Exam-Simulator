/* ExamPro — Settings: branding, appearance, study defaults and your data. */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Settings", sub: "Make it yours" };

  const ACCENT_SWATCHES = [
    ["indigo", "#6366f1"], ["cyan", "#06b6d4"], ["emerald", "#10b981"],
    ["amber", "#f59e0b"], ["rose", "#f43f5e"], ["purple", "#a855f7"]
  ];

  /* the colour shown on the custom swatch — the saved one, else the live accent */
  function customHex(s) {
    if (App.main.isHex(s.accentCustom)) return App.main.normHex(s.accentCustom);
    return App.main.accentPair().a;
  }

  View.render = function (root) {
    const u = App.u, store = App.store, br = App.branding;
    const s = store.state.settings;

    root.innerHTML =
      '<div class="view" style="max-width:820px;margin:0 auto">' +

      /* ---- branding ---- */
      '<section class="card card-pad rise settings-card">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("sparkle", 17) + "</div>" +
      "<div><h3>Branding</h3><p>Rename the app and give it your own mark. The browser tab updates too.</p></div></div>" +

      '<div class="brand-preview">' +
      '<div class="bp-badge" id="set-preview">' + br.markHtml(28) + "</div>" +
      '<div style="min-width:0">' +
      '<div class="bp-name" id="set-preview-name">' + u.esc(br.name()) + "</div>" +
      '<div class="bp-sub" id="set-preview-sub">' + u.esc(br.tagline()) + "</div>" +
      "</div>" +
      '<div class="bp-tab" title="How the browser tab will look">' +
      '<span class="bp-tab-ico" id="set-preview-tab"></span>' +
      '<span class="bp-tab-txt" id="set-preview-title">' + u.esc(br.name()) + "</span>" +
      "</div></div>" +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px" class="set-grid">' +
      "<div><label class='field-lbl'>App name</label>" +
      '<input class="input" id="set-name" maxlength="28" placeholder="' + u.esc(br.DEFAULT_NAME) + '" value="' + u.esc(s.appName || "") + '"></div>' +
      "<div><label class='field-lbl'>Tagline</label>" +
      '<input class="input" id="set-tagline" maxlength="40" placeholder="' + u.esc(br.DEFAULT_TAGLINE) + '" value="' + u.esc(s.appTagline == null ? "" : s.appTagline) + '"></div>' +
      "</div>" +

      "<label class='field-lbl' style='margin-top:18px'>Logo</label>" +
      '<div style="display:grid;gap:12px;margin-top:10px">' +
      '<div style="padding:24px;border:2px dashed var(--line);border-radius:14px;background:var(--surface-2);display:flex;flex-direction:column;align-items:center;gap:12px;cursor:pointer;transition:all 0.2s ease" id="upload-drop">' +
      '<div>' + App.icon("upload", 24) + "</div>" +
      '<div style="text-align:center">' +
      '<div style="font-weight:600;color:var(--ink);font-size:14px">Choose a logo image</div>' +
      '<div style="color:var(--muted);font-size:12px;margin-top:4px">PNG, SVG, JPG or WebP</div>' +
      "</div>" +
      '<button class="btn btn-primary btn-sm" id="set-upload" style="margin-top:4px">' + App.icon("upload", 12) + "Select file</button>" +
      '<input type="file" id="set-file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" style="display:none">' +
      "</div>" +
      (br.isCustom() ? '<button class="btn btn-ghost btn-sm" id="set-logo-reset" style="align-self:flex-start">' + App.icon("refresh", 14) + "Use default mark</button>" : "") +
      "</div>" +
      "</section>" +

      /* ---- appearance ---- */
      '<section class="card card-pad rise settings-card" style="animation-delay:.05s">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("palette", 17) + "</div>" +
      "<div><h3>Appearance</h3><p>Theme and accent colour, mirrored from the sidebar.</p></div></div>" +
      '<div class="switch-row"><div><div class="sr-txt">Dark mode</div><div class="sr-sub">Easier on the eyes for long sessions.</div></div>' +
      '<label class="switch"><input type="checkbox" id="set-dark"' + (s.theme === "dark" ? " checked" : "") + '><span class="track"></span><span class="thumb"></span></label></div>' +
      "<label class='field-lbl' style='margin-top:16px'>Accent</label>" +
      '<div class="accent-picker" id="set-accents">' +
      ACCENT_SWATCHES.map(function (a) {
        return '<button class="accent-swatch' + (s.accent === a[0] ? " on" : "") + '" data-accent="' + a[0] +
          '" style="background:' + a[1] + '" title="' + a[0] + '" aria-label="' + a[0] + '"></button>';
      }).join("") +
      '<span class="accent-sep"></span>' +
      '<button class="accent-swatch custom' + (s.accent === "custom" ? " on" : "") + '" id="set-accent-custom"' +
      ' style="background:' + u.esc(customHex(s)) + '" title="Custom colour" aria-label="Custom colour">' +
      App.icon("palette", 15) + "</button>" +
      "</div>" +

      '<div class="custom-accent' + (s.accent === "custom" ? " open" : "") + '" id="set-custom-row">' +
      '<input type="color" id="set-color" value="' + u.esc(customHex(s)) + '" aria-label="Pick a custom accent colour">' +
      '<input class="input mono" id="set-hex" maxlength="7" spellcheck="false" value="' + u.esc(customHex(s)) + '" aria-label="Accent hex value">' +
      '<span class="field-hint" style="margin:0">Any hex colour — the gradient partner is derived for you.</span>' +
      "</div>" +
      "</section>" +

      /* ---- study ---- */
      '<section class="card card-pad rise settings-card" style="animation-delay:.1s">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("target", 17) + "</div>" +
      "<div><h3>Study</h3><p>Defaults for review sessions and your daily target.</p></div></div>" +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="set-grid">' +
      "<div><label class='field-lbl'>Daily goal (questions)</label>" +
      "<select class='select' id='set-goal'>" +
      [10, 20, 30, 50, 100].map(function (n) {
        return '<option value="' + n + '"' + ((s.dailyGoal || 20) === n ? " selected" : "") + ">" + n + " a day</option>";
      }).join("") + "</select></div>" +
      "<div><label class='field-lbl'>Review session size</label>" +
      "<select class='select' id='set-session'>" +
      [10, 20, 30, 50].map(function (n) {
        return '<option value="' + n + '"' + ((s.reviewSize || 20) === n ? " selected" : "") + ">" + n + " cards</option>";
      }).join("") + "</select></div>" +
      "</div></section>" +

      /* ---- data ---- */
      '<section class="card card-pad rise settings-card" style="animation-delay:.15s">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("database", 17) + "</div>" +
      "<div><h3>Your data</h3><p>Everything lives in this browser. Back it up or move it to another machine.</p></div></div>" +
      '<div class="logo-row">' +
      '<button class="btn btn-soft btn-sm" id="set-export">' + App.icon("download", 14) + "Export everything</button>" +
      '<button class="btn btn-soft btn-sm" id="set-import">' + App.icon("upload", 14) + "Restore from backup</button>" +
      '<input type="file" id="set-import-file" accept=".json" style="display:none">' +
      "</div>" +
      '<div class="danger-zone">' +
      "<div><div class='dz-t'>Reset everything</div>" +
      "<div class='dz-s'>Deletes every bank, attempt, schedule and preference.</div></div>" +
      '<button class="btn btn-danger btn-sm" id="set-wipe">' + App.icon("trash", 14) + "Reset app</button>" +
      "</div></section>" +

      "</div>";

    wire(root.firstElementChild);
    refreshPreview();
  };

  /* ---------------- preview ---------------- */

  function refreshPreview() {
    const br = App.branding, u = App.u;
    const badge = document.getElementById("set-preview");
    if (badge) {
      badge.innerHTML = br.markHtml(28);
      badge.classList.toggle("has-img", !!br.logoData());
    }
    const name = document.getElementById("set-preview-name");
    if (name) name.textContent = br.name();
    const sub = document.getElementById("set-preview-sub");
    if (sub) sub.textContent = br.tagline() || "—";
    const title = document.getElementById("set-preview-title");
    if (title) title.textContent = br.name();
    const tab = document.getElementById("set-preview-tab");
    if (tab) tab.style.backgroundImage = "url(\"" + br.faviconUri().replace(/"/g, "%22") + "\")";
  }

  /* ---------------- wiring ---------------- */

  function wire(wrap) {
    const store = App.store, br = App.branding, ui = App.ui, u = App.u;

    /* keep the whole app in sync, not just this page */
    function applied() {
      br.apply();
      refreshPreview();
      App.main.renderSidebar("settings");
    }

    const nameIn = wrap.querySelector("#set-name");
    const tagIn = wrap.querySelector("#set-tagline");
    const push = u.debounce(function () {
      store.setSetting("appName", nameIn.value.trim() || null);
      store.setSetting("appTagline", tagIn.value.trim() === "" && tagIn.value.length === 0 ? null : tagIn.value.trim());
      applied();
    }, 200);
    nameIn.addEventListener("input", push);
    tagIn.addEventListener("input", push);

    /* logo upload */
    const file = wrap.querySelector("#set-file");
    const uploadDrop = wrap.querySelector("#upload-drop");
    const uploadBtn = wrap.querySelector("#set-upload");

    function openFile() { file.click(); }
    uploadBtn.onclick = openFile;
    if (uploadDrop) uploadDrop.onclick = openFile;

    file.onchange = function () {
      if (!file.files || !file.files[0]) return;
      br.readLogoFile(file.files[0], function (dataUri) {
        try {
          br.setLogoData(dataUri);
        } catch (e) {
          ui.toast("Could not save that image — it may be too large.", "err");
          return;
        }
        applied();
        View.render(document.getElementById("view"));
        ui.toast("Logo updated.", "ok");
      }, function (msg) {
        ui.toast(msg, "err");
      });
      file.value = "";
    };

    const logoReset = wrap.querySelector("#set-logo-reset");
    if (logoReset) logoReset.onclick = function () {
      br.setLogoIcon("logo");
      applied();
      View.render(document.getElementById("view"));
      ui.toast("Back to the default mark.", "info");
    };

    u.on(wrap, "click", "[data-logo]", function (e, el) {
      br.setLogoIcon(el.dataset.logo);
      wrap.querySelectorAll("[data-logo]").forEach(function (o) { o.classList.toggle("on", o === el); });
      applied();
    });

    /* appearance */
    wrap.querySelector("#set-dark").addEventListener("change", function (e) {
      store.setSetting("theme", e.target.checked ? "dark" : "light");
      App.main.applyTheme();
      applied();
    });
    const customBtn = wrap.querySelector("#set-accent-custom");
    const customRow = wrap.querySelector("#set-custom-row");
    const colorIn = wrap.querySelector("#set-color");
    const hexIn = wrap.querySelector("#set-hex");

    function markAccent(activeEl) {
      wrap.querySelectorAll(".accent-swatch").forEach(function (o) {
        o.classList.toggle("on", o === activeEl);
      });
    }

    u.on(wrap, "click", "[data-accent]", function (e, el) {
      store.setSetting("accent", el.dataset.accent);
      App.main.applyAccent();
      markAccent(el);
      customRow.classList.remove("open");
      applied();
    });

    /* custom accent: swatch reveals the picker and switches to it */
    function useCustom(hex) {
      if (!App.main.isHex(hex)) return false;
      const norm = App.main.normHex(hex);
      store.setSetting("accentCustom", norm);
      store.setSetting("accent", "custom");
      App.main.applyAccent();
      customBtn.style.background = norm;
      markAccent(customBtn);
      applied();
      return true;
    }

    customBtn.onclick = function () {
      customRow.classList.add("open");
      useCustom(colorIn.value);
    };
    colorIn.addEventListener("input", function () {
      hexIn.value = colorIn.value;
      useCustom(colorIn.value);
    });
    hexIn.addEventListener("input", u.debounce(function () {
      if (useCustom(hexIn.value)) {
        colorIn.value = App.main.normHex(hexIn.value);
        hexIn.classList.remove("invalid");
      } else {
        hexIn.classList.add("invalid");
      }
    }, 180));

    /* study */
    wrap.querySelector("#set-goal").onchange = function (e) {
      store.setSetting("dailyGoal", parseInt(e.target.value, 10));
    };
    wrap.querySelector("#set-session").onchange = function (e) {
      store.setSetting("reviewSize", parseInt(e.target.value, 10));
    };

    /* data */
    wrap.querySelector("#set-export").onclick = function () {
      const dump = {
        app: "ExamPro",
        version: 3,
        exportedAt: new Date().toISOString(),
        banks: store.state.banks,
        history: store.state.history,
        mastered: store.state.mastered,
        srs: store.state.srs,
        perf: store.state.perf,
        activity: store.state.activity,
        settings: store.state.settings
      };
      u.download("exampro-backup-" + App.srs.dayKey() + ".json", JSON.stringify(dump, null, 2));
      ui.toast("Backup downloaded.", "ok");
    };

    const impFile = wrap.querySelector("#set-import-file");
    wrap.querySelector("#set-import").onclick = function () { impFile.click(); };
    impFile.onchange = function () {
      const f = impFile.files && impFile.files[0];
      impFile.value = "";
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function () {
        let data;
        try {
          data = JSON.parse(String(reader.result));
        } catch (e) {
          ui.toast("That file isn't valid JSON.", "err");
          return;
        }
        if (!data || typeof data !== "object" || !data.banks) {
          ui.toast("That doesn't look like an ExamPro backup.", "err");
          return;
        }
        ui.confirm({
          title: "Restore this backup?",
          desc: "Everything currently in this browser is replaced by the backup's " +
                Object.keys(data.banks).length + " bank(s).",
          confirmLabel: "Restore",
          danger: true
        }, function () {
          store.state.banks = data.banks || {};
          store.state.history = data.history || {};
          store.state.mastered = data.mastered || {};
          store.state.srs = data.srs || {};
          store.state.perf = data.perf || {};
          store.state.activity = data.activity || {};
          if (data.settings) store.state.settings = Object.assign(store.state.settings, data.settings);
          store.saveBanks(); store.saveHistory(); store.saveMastered();
          store.saveSrs(); store.savePerf(); store.saveActivity(); store.saveSettings();
          store.clearSession();
          App.main.applyTheme();
          applied();
          ui.toast("Backup restored.", "ok");
          App.router.go("#/dashboard");
        });
      };
      reader.readAsText(f);
    };

    wrap.querySelector("#set-wipe").onclick = function () {
      ui.confirm({
        title: "Reset everything?",
        desc: "Every bank, attempt, review schedule and preference is deleted. This cannot be undone.",
        confirmLabel: "Delete everything",
        danger: true
      }, function () {
        store.bankNames().slice().forEach(function (n) { store.deleteBank(n); });
        store.state.activity = {};
        store.state.settings = { theme: "light", accent: "indigo", sidebarCollapsed: false, dailyGoal: 20 };
        store.saveActivity();
        store.saveSettings();
        store.clearSession();
        App.main.applyTheme();
        applied();
        ui.toast("Everything reset.", "info");
        App.router.go("#/dashboard");
      });
    };
  }

  App.views.settings = View;
})();
