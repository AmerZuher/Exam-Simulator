/* ExamPro — Settings: branding, appearance, study defaults and your data. */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Settings", sub: "Make it yours" };

  const ACCENT_SWATCHES = [
    ["indigo", "#6366f1"], ["cyan", "#06b6d4"], ["emerald", "#10b981"],
    ["amber", "#f59e0b"], ["rose", "#f43f5e"], ["purple", "#a855f7"],
    ["sky", "#7aa2f7"], ["mint", "#9ece6a"], ["coral", "#f7768e"], ["gold", "#ff9e64"]
  ];

  const THEME_OPTS = [
    { key: "light", label: "Light", icon: "sun" },
    { key: "sepia", label: "Sepia", icon: "book" },
    { key: "dark", label: "Dark", icon: "moon" },
    { key: "oled", label: "OLED", icon: "moon" },
    { key: "tokyo-night", label: "Tokyo Night", icon: "sparkle" },
    { key: "nord", label: "Nord", icon: "globe" }
  ];

  const AI_PROVIDERS = [
    { key: "openai", label: "OpenAI" },
    { key: "anthropic", label: "Anthropic" },
    { key: "google", label: "Google" },
    { key: "other", label: "Other" }
  ];
  const AI_MODEL_PLACEHOLDERS = {
    openai: "e.g. gpt-4o", anthropic: "e.g. claude-sonnet-5", google: "e.g. gemini-2.5-pro", other: "e.g. model name"
  };
  function aiModelPlaceholder(provider) { return AI_MODEL_PLACEHOLDERS[provider] || AI_MODEL_PLACEHOLDERS.other; }

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

      /* ---- user profile ---- */
      '<section class="card card-pad rise settings-card">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("user", 17) + "</div>" +
      "<div><h3>User Profile</h3><p>Your name, role and picture — shown in the sidebar and browser tab.</p></div></div>" +

      '<div class="profile-head">' +
      '<span class="avatar-ring">' +
      '<span class="bp-badge editable" id="set-preview" role="button" tabindex="0" aria-label="Change picture">' + br.markHtml(30) + "</span>" +
      "</span>" +
      '<div style="min-width:0">' +
      '<div class="bp-name" id="set-preview-name">' + u.esc(br.name()) + "</div>" +
      '<div class="bp-sub" id="set-preview-sub" style="display:' + (br.tagline() ? "" : "none") + '">' + App.icon("briefcase", 12, 2.4) + '<span id="set-preview-sub-txt">' + u.esc(br.tagline()) + "</span></div>" +
      '<div class="profile-actions">' +
      '<button class="btn btn-ghost btn-sm" id="set-upload">' + App.icon("upload", 13) + "Change picture</button>" +
      (br.isCustom() ? '<button class="btn btn-ghost btn-sm" id="set-logo-reset">' + App.icon("trash", 13) + "Remove</button>" : "") +
      '<input type="file" id="set-file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" style="display:none">' +
      "</div></div></div>" +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px" class="set-grid">' +
      "<div><label class='field-lbl'>User name</label>" +
      '<input class="input" id="set-name" maxlength="28" placeholder="' + u.esc(br.DEFAULT_NAME) + '" value="' + u.esc(s.appName || "") + '"></div>' +
      "<div><label class='field-lbl'>User role</label>" +
      '<input class="input" id="set-tagline" maxlength="40" placeholder="e.g. Software Engineer" value="' + u.esc(s.appTagline == null ? "" : s.appTagline) + '"></div>' +
      "</div>" +
      "</section>" +

      /* ---- appearance ---- */
      '<section class="card card-pad rise settings-card" style="animation-delay:.05s">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("palette", 17) + "</div>" +
      "<div><h3>Appearance</h3><p>Theme and accent colour, mirrored from the sidebar.</p></div></div>" +
      "<label class='field-lbl'>Theme</label>" +
      '<div class="seg-tabs" id="set-theme" style="flex-wrap:wrap">' +
      THEME_OPTS.map(function (t) {
        return '<button type="button" class="seg-tab' + ((s.theme || "light") === t.key ? " on" : "") + '" data-theme-opt="' + t.key + '">' +
          App.icon(t.icon, 13) + t.label + "</button>";
      }).join("") +
      "</div>" +
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

      /* ---- personalization ---- */
      '<section class="card card-pad rise settings-card" style="animation-delay:.12s">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("layers", 17) + "</div>" +
      "<div><h3>Personalization</h3><p>Pin exam groups, specific banks (with a launch mode), or your own links to the sidebar. Add, remove and reorder freely.</p></div></div>" +
      '<div id="sidebar-links-list" class="shortcut-list"></div>' +
      '<button class="btn btn-soft btn-sm" id="set-add-shortcut" style="margin-top:12px">' + App.icon("layers", 14) + "Add shortcut</button>" +
      "</section>" +

      /* ---- ai (beta) ---- */
      '<section class="card card-pad rise settings-card" style="animation-delay:.17s">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("robot", 17) + "</div>" +
      "<div><h3>AI<span class='beta-badge'>Beta</span></h3>" +
      "<p>Connect your own AI provider for generation features to use later. Not wired to any live calls yet — stored only in this browser.</p></div></div>" +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="set-grid">' +
      "<div><label class='field-lbl'>Provider</label><select class='select' id='set-ai-provider'>" +
      AI_PROVIDERS.map(function (p) { return '<option value="' + p.key + '"' + ((s.aiProvider || "openai") === p.key ? " selected" : "") + ">" + p.label + "</option>"; }).join("") +
      "</select></div>" +
      "<div><label class='field-lbl'>Model</label>" +
      '<input class="input" id="set-ai-model" maxlength="60" placeholder="' + u.esc(aiModelPlaceholder(s.aiProvider || "openai")) + '" value="' + u.esc(s.aiModel || "") + '"></div>' +
      "</div>" +
      "<label class='field-lbl' style='margin-top:14px'>API key</label>" +
      '<div style="display:flex;gap:8px">' +
      '<input class="input mono" type="password" id="set-ai-key" maxlength="200" placeholder="sk-…" value="' + u.esc(s.aiApiKey || "") + '" style="flex:1">' +
      '<button class="icon-btn" id="set-ai-key-toggle" title="Show API key" aria-label="Show API key">' + App.icon("eyeOff", 15) + "</button>" +
      "</div>" +
      '<div class="field-hint">Stored only in this browser’s local storage — ExamPro never sends it anywhere. It’s included in Export backups below, so keep those files secure.</div>' +
      "</section>" +

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
    renderShortcuts();
    App.components.enhanceSelects(root);
  };

  /* ---------------- personalization (sidebar shortcuts) ---------------- */

  function shortcutTypeLabel(l) {
    if (l.type === "group") return "Group";
    if (l.type === "bank") return l.mode === "exam" ? "Exam" : l.mode === "practice" ? "Practice" : "QA Review";
    return "Link";
  }
  function shortcutIconHtml(l) {
    if (l.type === "group") return App.ui.groupBadge(l.groupName, 15, "sm");
    if (l.type === "bank") return App.ui.bankBadge(l.bankKey, 15, "sm");
    return '<span class="bank-badge sm has-img">' + App.ui.linkFavicon(l.url, 18) + "</span>";
  }
  function shortcutLabel(l) {
    if (l.type === "group") return l.groupName;
    if (l.type === "bank") return l.bankKey;
    return l.label;
  }
  function shortcutStale(l) {
    if (l.type === "group") return !App.store.getGroup(l.groupName);
    if (l.type === "bank") return !App.store.getBank(l.bankKey);
    return false;
  }

  function shortcutRow(l, i, total) {
    const stale = shortcutStale(l);
    return '<div class="shortcut-row' + (stale ? " is-stale" : "") + '">' +
      shortcutIconHtml(l) +
      '<div class="shortcut-body"><div class="shortcut-label">' + App.u.esc(shortcutLabel(l)) +
      (stale ? ' <span class="chip chip-bad">Removed</span>' : "") + "</div>" +
      '<span class="chip chip-mut">' + shortcutTypeLabel(l) + "</span></div>" +
      '<div class="shortcut-actions">' +
      '<button class="icon-btn" data-move="-1" data-id="' + l.id + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Move up" title="Move up"><span style="display:inline-flex;transform:rotate(180deg)">' + App.icon("chevDown", 13, 2.2) + "</span></button>" +
      '<button class="icon-btn" data-move="1" data-id="' + l.id + '"' + (i === total - 1 ? " disabled" : "") + ' aria-label="Move down" title="Move down">' + App.icon("chevDown", 13, 2.2) + "</button>" +
      '<button class="icon-btn danger" data-remove-link="' + l.id + '" aria-label="Remove shortcut" title="Remove">' + App.icon("trash", 13) + "</button>" +
      "</div></div>";
  }

  function renderShortcuts() {
    const list = document.getElementById("sidebar-links-list");
    if (!list) return;
    const links = App.store.getSidebarLinks();
    list.innerHTML = links.length
      ? links.map(function (l, i) { return shortcutRow(l, i, links.length); }).join("")
      : '<div class="field-hint">No shortcuts yet — add one below.</div>';

    list.querySelectorAll("[data-move]").forEach(function (btn) {
      btn.onclick = function () {
        App.store.moveSidebarLink(btn.dataset.id, parseInt(btn.dataset.move, 10));
        renderShortcuts();
        App.main.renderSidebar("settings");
      };
    });
    list.querySelectorAll("[data-remove-link]").forEach(function (btn) {
      btn.onclick = function () {
        App.store.removeSidebarLink(btn.dataset.removeLink);
        renderShortcuts();
        App.main.renderSidebar("settings");
        App.ui.toast("Shortcut removed.", "info");
      };
    });
  }

  function openAddShortcutModal() {
    const store = App.store, u = App.u;
    const groups = store.groupNames();
    const banks = store.bankNames();

    const veil = App.ui.customModal(
      '<div class="modal-head"><div><div class="modal-title">Add sidebar shortcut</div>' +
      '<div class="modal-sub">Pin something to the sidebar for one-click access.</div></div>' +
      '<button class="icon-btn" data-x>' + App.icon("x", 15) + "</button></div>" +

      '<div class="seg-tabs">' +
      '<button type="button" class="seg-tab on" data-stype="group">' + App.icon("layers", 13) + "Exam Group</button>" +
      '<button type="button" class="seg-tab" data-stype="bank">' + App.icon("book", 13) + "Exam Bank</button>" +
      '<button type="button" class="seg-tab" data-stype="link">' + App.icon("link", 13) + "Custom Link</button>" +
      "</div>" +

      '<div id="stype-group" style="margin-top:14px">' +
      (groups.length
        ? "<label class='field-lbl'>Group</label><select class='select' id='sg-group'>" +
          groups.map(function (g) { return '<option value="' + u.esc(g) + '">' + u.esc(g) + "</option>"; }).join("") + "</select>"
        : '<div class="field-hint">No exam groups yet — create one from the dashboard first.</div>') +
      "</div>" +

      '<div id="stype-bank" style="display:none;margin-top:14px">' +
      (banks.length
        ? "<label class='field-lbl'>Bank</label><select class='select' id='sg-bank'>" +
          banks.map(function (n) { return '<option value="' + u.esc(n) + '">' + u.esc(n) + "</option>"; }).join("") + "</select>" +
          "<label class='field-lbl' style='margin-top:12px'>Launch mode</label>" +
          '<div class="seg-tabs">' +
          '<button type="button" class="seg-tab on" data-smode="exam">' + App.icon("play", 13) + "Exam</button>" +
          '<button type="button" class="seg-tab" data-smode="study">' + App.icon("study", 13) + "QA Review</button>" +
          '<button type="button" class="seg-tab" data-smode="practice">' + App.icon("brain", 13) + "Practice</button>" +
          "</div>"
        : '<div class="field-hint">No exam banks yet — import one first.</div>') +
      "</div>" +

      '<div id="stype-link" style="display:none;margin-top:14px">' +
      "<label class='field-lbl'>Label</label><input class='input' id='sg-label' maxlength='40' placeholder='e.g. Course notes'>" +
      "<label class='field-lbl' style='margin-top:12px'>URL</label>" +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<span class="glink-preview-wrap"><img id="sg-preview" class="link-favicon" width="18" height="18" alt="" style="visibility:hidden"></span>' +
      '<input class="input" id="sg-url" maxlength="300" placeholder="https://… — paste a link and its logo shows up here" style="flex:1">' +
      "</div>" +
      "</div>" +

      '<div class="modal-foot"><button class="btn btn-ghost" data-x>Cancel</button>' +
      '<button class="btn btn-primary" id="sg-add">' + App.icon("check", 15) + "Add shortcut</button></div>"
    );

    let activeType = "group", activeMode = "exam";
    veil.querySelectorAll("[data-stype]").forEach(function (btn) {
      btn.onclick = function () {
        activeType = btn.dataset.stype;
        veil.querySelectorAll("[data-stype]").forEach(function (b) { b.classList.toggle("on", b === btn); });
        veil.querySelector("#stype-group").style.display = activeType === "group" ? "" : "none";
        veil.querySelector("#stype-bank").style.display = activeType === "bank" ? "" : "none";
        veil.querySelector("#stype-link").style.display = activeType === "link" ? "" : "none";
      };
    });
    veil.querySelectorAll("[data-smode]").forEach(function (btn) {
      btn.onclick = function () {
        activeMode = btn.dataset.smode;
        veil.querySelectorAll("[data-smode]").forEach(function (b) { b.classList.toggle("on", b === btn); });
      };
    });

    App.components.enhanceSelects(veil);

    /* Live favicon preview — same touch as the group detail page's add-link form */
    const urlIn = veil.querySelector("#sg-url");
    const preview = veil.querySelector("#sg-preview");
    if (urlIn && preview) {
      urlIn.addEventListener("input", u.debounce(function () {
        const fav = u.faviconUrl(urlIn.value.trim());
        if (!fav) { preview.style.visibility = "hidden"; return; }
        preview.onerror = function () { preview.style.visibility = "hidden"; };
        preview.src = fav;
        preview.style.visibility = "visible";
      }, 250));
    }

    veil.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = App.ui.closeModal; });
    veil.querySelector("#sg-add").onclick = function () {
      if (activeType === "group") {
        const sel = veil.querySelector("#sg-group");
        if (!sel || !sel.value) { App.ui.toast("Create an exam group first.", "err"); return; }
        store.addSidebarLink({ type: "group", groupName: sel.value });
      } else if (activeType === "bank") {
        const sel = veil.querySelector("#sg-bank");
        if (!sel || !sel.value) { App.ui.toast("Import an exam bank first.", "err"); return; }
        store.addSidebarLink({ type: "bank", bankKey: sel.value, mode: activeMode });
      } else {
        const label = veil.querySelector("#sg-label").value.trim();
        const url = veil.querySelector("#sg-url").value.trim();
        if (!label || !url) { App.ui.toast("Enter both a label and a URL.", "err"); return; }
        store.addSidebarLink({ type: "link", label: label, url: url });
      }
      App.ui.closeModal();
      App.ui.toast("Shortcut added.", "ok");
      renderShortcuts();
      App.main.renderSidebar("settings");
    };
  }

  /* ---------------- preview ---------------- */

  function refreshPreview() {
    const br = App.branding;
    const badge = document.getElementById("set-preview");
    if (badge) {
      badge.innerHTML = br.markHtml(30);
      badge.classList.toggle("has-img", !!br.logoData());
    }
    const name = document.getElementById("set-preview-name");
    if (name) name.textContent = br.name();
    const sub = document.getElementById("set-preview-sub");
    const subTxt = document.getElementById("set-preview-sub-txt");
    if (sub && subTxt) {
      subTxt.textContent = br.tagline();
      sub.style.display = br.tagline() ? "" : "none";
    }
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
      store.setSetting("appTagline", tagIn.value.trim() === "" ? null : tagIn.value.trim());
      applied();
    }, 200);
    nameIn.addEventListener("input", push);
    tagIn.addEventListener("input", push);

    /* profile picture — click the avatar itself, or the button beside it */
    const file = wrap.querySelector("#set-file");
    const avatar = wrap.querySelector("#set-preview");
    const uploadBtn = wrap.querySelector("#set-upload");

    function openFile() { file.click(); }
    uploadBtn.onclick = openFile;
    if (avatar) {
      avatar.onclick = openFile;
      avatar.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFile(); } };
    }

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
        ui.toast("Picture updated.", "ok");
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
      ui.toast("Picture removed.", "info");
    };

    u.on(wrap, "click", "[data-logo]", function (e, el) {
      br.setLogoIcon(el.dataset.logo);
      wrap.querySelectorAll("[data-logo]").forEach(function (o) { o.classList.toggle("on", o === el); });
      applied();
    });

    /* appearance */
    wrap.querySelectorAll("[data-theme-opt]").forEach(function (btn) {
      btn.onclick = function () {
        store.setSetting("theme", btn.dataset.themeOpt);
        App.main.applyTheme();
        wrap.querySelectorAll("[data-theme-opt]").forEach(function (b) { b.classList.toggle("on", b === btn); });
        applied();
      };
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

    /* personalization */
    const addShortcutBtn = wrap.querySelector("#set-add-shortcut");
    if (addShortcutBtn) addShortcutBtn.onclick = openAddShortcutModal;

    /* ai (beta) — plain local settings, no validation beyond "it's text" since
       nothing reads/calls out with these yet */
    const aiProviderSel = wrap.querySelector("#set-ai-provider");
    const aiModelIn = wrap.querySelector("#set-ai-model");
    const aiKeyIn = wrap.querySelector("#set-ai-key");
    aiProviderSel.onchange = function () {
      store.setSetting("aiProvider", aiProviderSel.value);
      aiModelIn.placeholder = aiModelPlaceholder(aiProviderSel.value);
    };
    aiModelIn.addEventListener("input", u.debounce(function () {
      store.setSetting("aiModel", aiModelIn.value.trim());
    }, 200));
    aiKeyIn.addEventListener("input", u.debounce(function () {
      store.setSetting("aiApiKey", aiKeyIn.value.trim());
    }, 200));
    const aiKeyToggle = wrap.querySelector("#set-ai-key-toggle");
    if (aiKeyToggle) aiKeyToggle.onclick = function () {
      const hidden = aiKeyIn.type === "password";
      aiKeyIn.type = hidden ? "text" : "password";
      const label = hidden ? "Hide API key" : "Show API key";
      aiKeyToggle.title = label;
      aiKeyToggle.setAttribute("aria-label", label);
    };

    /* data */
    wrap.querySelector("#set-export").onclick = function () {
      /* Every top-level slot store.js actually persists to localStorage —
         see KEYS in store.js. Keep this in sync if a new one is ever added,
         so "Export everything" always means everything. */
      const dump = {
        app: "ExamPro",
        version: 4,
        exportedAt: new Date().toISOString(),
        banks: store.state.banks,
        groups: store.state.groups,
        history: store.state.history,
        mastered: store.state.mastered,
        srs: store.state.srs,
        perf: store.state.perf,
        activity: store.state.activity,
        dueDates: store.state.dueDates,
        session: store.state.session,
        practiceSession: store.state.practiceSession,
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
          store.state.groups = data.groups || {};
          store.state.history = data.history || {};
          store.state.mastered = data.mastered || {};
          store.state.srs = data.srs || {};
          store.state.perf = data.perf || {};
          store.state.activity = data.activity || {};
          store.state.dueDates = data.dueDates || {};
          store.state.session = data.session || null;
          store.state.practiceSession = data.practiceSession || null;
          if (data.settings) store.state.settings = Object.assign(store.state.settings, data.settings);
          store.saveBanks(); store.saveGroups(); store.saveHistory(); store.saveMastered();
          store.saveSrs(); store.savePerf(); store.saveActivity(); store.saveDueDates(); store.saveSettings();
          store.saveSession(); store.savePracticeSession();
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
        store.state.groups = {};
        store.state.activity = {};
        store.state.dueDates = {};
        store.state.settings = { theme: "light", accent: "indigo", sidebarCollapsed: false, dailyGoal: 20, sidebarLinks: [] };
        store.saveGroups();
        store.saveActivity();
        store.saveDueDates();
        store.saveSettings();
        store.clearSession();
        store.clearPracticeSession();
        App.main.applyTheme();
        applied();
        ui.toast("Everything reset.", "info");
        App.router.go("#/dashboard");
      });
    };
  }

  App.views.settings = View;
})();
