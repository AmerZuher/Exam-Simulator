/* ExamPro — UI kit: toasts, modals, rings, sparklines, chips, confetti */
window.App = window.App || {};

(function () {
  const U = () => App.u;
  const UI = {};

  /* ---------------- toasts ---------------- */
  UI.toast = function (msg, type) {
    type = type || "ok";
    let stack = document.getElementById("toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toast-stack";
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = "toast " + type;
    const iconName = type === "ok" ? "check" : type === "err" ? "warn" : "info";
    el.innerHTML =
      '<span class="t-ico">' + App.icon(iconName, 15, 2.2) + "</span>" +
      "<span>" + U().esc(msg) + "</span>";
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); }, 320);
    }, 3400);
  };

  /* Clipboard copy with the same execCommand fallback everywhere a "Copy
     ___" button needs it (older/insecure-context browsers lack
     navigator.clipboard). */
  UI.copyText = function (text, okMsg) {
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); UI.toast(okMsg, "ok"); }
      catch (e) { UI.toast("Copy failed — select and copy manually.", "err"); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { UI.toast(okMsg, "ok"); }, fallback);
    } else fallback();
  };

  /* ---------------- modals ---------------- */
  function openModal(html) {
    closeModal();
    const veil = document.createElement("div");
    veil.className = "modal-veil";
    veil.id = "modal-veil";
    veil.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + "</div>";
    veil.addEventListener("mousedown", function (e) { if (e.target === veil) closeModal(); });
    document.body.appendChild(veil);
    document.addEventListener("keydown", escClose);
    return veil;
  }
  function escClose(e) { if (e.key === "Escape") closeModal(); }
  function closeModal() {
    const v = document.getElementById("modal-veil");
    if (v) v.remove();
    document.removeEventListener("keydown", escClose);
    if (App.components && App.components.closeAllSelects) App.components.closeAllSelects();
  }
  UI.closeModal = closeModal;

  UI.confirm = function (opts, onYes) {
    const veil = openModal(
      '<div class="modal-head"><div>' +
      '<div class="modal-title">' + U().esc(opts.title || "Are you sure?") + "</div>" +
      (opts.desc ? '<div class="modal-sub">' + U().esc(opts.desc) + "</div>" : "") +
      "</div></div>" +
      (opts.bodyHtml || "") +
      '<div class="modal-foot">' +
      '<button class="btn btn-ghost" data-act="no">Cancel</button>' +
      '<button class="btn ' + (opts.danger ? "" : "btn-primary") + '" data-act="yes" style="' + (opts.danger ? "background:var(--bad);color:#fff;" : "") + '">' +
      U().esc(opts.confirmLabel || "Confirm") + "</button>" +
      "</div>"
    );
    veil.querySelector('[data-act="no"]').onclick = closeModal;
    veil.querySelector('[data-act="yes"]').onclick = function () { closeModal(); if (onYes) onYes(); };
  };

  UI.prompt = function (opts, onOk) {
    const veil = openModal(
      '<div class="modal-head"><div>' +
      '<div class="modal-title">' + U().esc(opts.title || "Enter value") + "</div>" +
      (opts.desc ? '<div class="modal-sub">' + U().esc(opts.desc) + "</div>" : "") +
      "</div></div>" +
      '<input class="input" id="modal-prompt-input" value="' + U().esc(opts.value || "") + '" placeholder="' + U().esc(opts.placeholder || "") + '" maxlength="80">' +
      '<div class="modal-foot">' +
      '<button class="btn btn-ghost" data-act="no">Cancel</button>' +
      '<button class="btn btn-primary" data-act="yes">' + U().esc(opts.confirmLabel || "Save") + "</button>" +
      "</div>"
    );
    const input = veil.querySelector("#modal-prompt-input");
    input.focus();
    input.select();
    function submit() {
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      closeModal();
      if (onOk) onOk(v);
    }
    veil.querySelector('[data-act="no"]').onclick = closeModal;
    veil.querySelector('[data-act="yes"]').onclick = submit;
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  };

  UI.customModal = openModal;

  /* ---------------- bank icon / tone / logo picker ---------------- */
  /* Renders a badge from a plain {icon, tone, logo} look — the one place
     that decides how a badge is drawn, whether it's backed by a stored bank
     or a look the caller is still deciding on (e.g. the Import screen,
     before the bank exists). UI.bankBadge is a thin wrapper for the common
     "look up an existing bank's saved look" case. */
  UI.badgeHtml = function (look, size, cls, attrs) {
    size = size || 20;
    look = look || {};
    /* the box itself is always sized by the .bank-badge/.lg/.sm/.xs CSS
       classes, exactly like the icon badge below — `size` only ever sizes
       an icon *glyph*, never the box, so a logo badge lines up pixel-for-
       pixel with a normal icon badge in the same spot instead of shrinking
       to a stray inset thumbnail. */
    if (look.logo) {
      return '<span class="bank-badge has-img' + (cls ? " " + cls : "") + '"' + (attrs ? " " + attrs : "") + ">" +
        '<img class="bank-badge-img" src="' + U().esc(look.logo) + '" alt="" draggable="false"></span>';
    }
    return '<span class="bank-badge tone-' + (look.tone || "acc") + (cls ? " " + cls : "") + '"' +
      (attrs ? " " + attrs : "") + ">" + App.icon(look.icon || "grad", size) + "</span>";
  };

  UI.bankBadge = function (bankName, size, cls, attrs) {
    return UI.badgeHtml({
      icon: App.store.bankIcon(bankName),
      tone: App.store.bankTone(bankName),
      logo: App.store.bankLogo(bankName)
    }, size, cls, attrs);
  };

  /* A badge that opens the picker when clicked — wire the container with
     UI.wireBankBadges() to activate. */
  UI.editableBankBadge = function (bankName, size, cls) {
    return UI.bankBadge(bankName, size, "editable" + (cls ? " " + cls : ""),
      'data-look="' + U().esc(bankName) + '" role="button" tabindex="0" title="Change icon"');
  };

  /* Delegated handler for every editable badge inside `root`. */
  UI.wireBankBadges = function (root, onSaved) {
    U().on(root, "click", "[data-look]", function (e, el) {
      e.stopPropagation();
      UI.pickBankLook(el.dataset.look, onSaved);
    });
    U().on(root, "keydown", "[data-look]", function (e, el) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        UI.pickBankLook(el.dataset.look, onSaved);
      }
    });
  };

  /* Generic look-picker modal: icon+tone grid, or an uploaded image. Used
     both to re-style an existing bank (pickBankLook) and — via the same
     function — to choose a look for a bank that doesn't exist yet (the
     Import screen), where there's no bank name to read/write, only a plain
     {icon, tone, logo} object the caller owns. */
  UI.pickLook = function (opts) {
    const u = U();
    let icon = opts.icon || "grad";
    let tone = opts.tone || "acc";
    let logo = opts.logo || null;

    const veil = openModal(
      '<div class="modal-head"><div>' +
      '<div class="modal-title">' + u.esc(opts.title || "Icon") + "</div>" +
      (opts.subtitle ? '<div class="modal-sub">' + u.esc(opts.subtitle) + "</div>" : "") + "</div>" +
      '<button class="icon-btn" data-x>' + App.icon("x", 15) + "</button></div>" +

      (opts.nameField
        ? "<label class='field-lbl'>Name</label>" +
          '<input class="input" id="pick-name" value="' + u.esc(opts.nameValue || "") + '" maxlength="60" style="margin-bottom:16px">'
        : "") +

      (opts.descField
        ? "<label class='field-lbl'>Description</label>" +
          '<textarea class="textarea" id="pick-desc" maxlength="200" rows="2" placeholder="What ties these banks together?" style="margin-bottom:16px;font-family:inherit;font-size:13px;font-weight:500;line-height:1.5">' + u.esc(opts.descValue || "") + "</textarea>"
        : "") +

      '<div class="picker-preview">' +
      '<span class="bank-badge lg' + (logo ? " has-img" : " tone-" + tone) + '" id="pick-preview">' +
      (logo ? '<img class="bank-badge-img" src="' + u.esc(logo) + '" alt="">' : App.icon(icon, 30)) + "</span>" +
      '<div><div class="pp-name">' + u.esc(opts.subtitle || "Preview") + "</div>" +
      '<div class="pp-sub">This is how it appears everywhere.</div></div></div>' +

      "<label class='field-lbl'>Colour</label>" +
      '<div class="tone-row" id="pick-tones">' +
      App.bankTones.map(function (t) {
        return '<button class="tone-dot tone-' + t + (t === tone ? " on" : "") +
          '" data-tone="' + t + '" aria-label="' + t + ' colour"></button>';
      }).join("") + "</div>" +

      "<label class='field-lbl' style='margin-top:14px'>Icon</label>" +
      '<div class="icon-grid" id="pick-icons">' +
      App.bankIcons.map(function (n) {
        return '<button class="icon-cell' + (n === icon && !logo ? " on" : "") + '" data-icon="' + n +
          '" title="' + n + '">' + App.icon(n, 19) + "</button>";
      }).join("") + "</div>" +

      "<label class='field-lbl' style='margin-top:14px'>Or upload your own</label>" +
      '<div class="pick-upload">' +
      '<button class="btn btn-ghost btn-sm" id="pick-upload-btn">' + App.icon("upload", 13) + "Upload image</button>" +
      '<input type="file" id="pick-upload-file" accept="image/*" style="display:none">' +
      '<button class="btn btn-ghost btn-sm" id="pick-upload-clear" style="display:' + (logo ? "" : "none") + '">' + App.icon("x", 13) + "Remove image</button>" +
      "</div>" +

      '<div class="modal-foot">' +
      '<button class="btn btn-ghost" data-x>Cancel</button>' +
      '<button class="btn btn-primary" id="pick-save">' + App.icon("check", 15) + "Save</button>" +
      "</div>"
    );

    const preview = veil.querySelector("#pick-preview");
    const clearBtn = veil.querySelector("#pick-upload-clear");
    function repaint() {
      preview.className = "bank-badge lg" + (logo ? " has-img" : " tone-" + tone);
      preview.innerHTML = logo ? '<img class="bank-badge-img" src="' + u.esc(logo) + '" alt="">' : App.icon(icon, 30);
      veil.querySelectorAll("[data-icon]").forEach(function (o) { o.classList.toggle("on", !logo && o.dataset.icon === icon); });
      clearBtn.style.display = logo ? "" : "none";
    }

    veil.querySelectorAll("[data-tone]").forEach(function (b) {
      b.onclick = function () {
        tone = b.dataset.tone;
        veil.querySelectorAll("[data-tone]").forEach(function (o) { o.classList.toggle("on", o === b); });
        repaint();
      };
    });
    veil.querySelectorAll("[data-icon]").forEach(function (b) {
      b.onclick = function () {
        icon = b.dataset.icon;
        logo = null;
        repaint();
      };
    });

    const uploadBtn = veil.querySelector("#pick-upload-btn");
    const uploadFile = veil.querySelector("#pick-upload-file");
    uploadBtn.onclick = function () { uploadFile.click(); };
    uploadFile.onchange = function () {
      const f = uploadFile.files[0];
      if (!f) return;
      App.u.readImageFile(f, {}, function (dataUri) {
        logo = dataUri;
        repaint();
        UI.toast("Image loaded — click Save to apply it.", "ok");
      }, function (msg) { UI.toast(msg, "err"); });
    };
    clearBtn.onclick = function () { logo = null; repaint(); };

    veil.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = closeModal; });
    veil.querySelector("#pick-save").onclick = function () {
      const result = { icon: logo ? null : icon, tone: tone, logo: logo };
      if (opts.nameField) result.name = veil.querySelector("#pick-name").value.trim();
      if (opts.descField) result.description = veil.querySelector("#pick-desc").value.trim();
      closeModal();
      if (opts.onSave) opts.onSave(result);
    };
  };

  UI.pickBankLook = function (bankName, onSaved) {
    UI.pickLook({
      title: "Bank icon",
      subtitle: bankName,
      icon: App.store.bankIcon(bankName),
      tone: App.store.bankTone(bankName),
      logo: App.store.bankLogo(bankName),
      onSave: function (result) {
        App.store.setBankLook(bankName, result.icon, result.tone, result.logo);
        UI.toast("Icon updated.", "ok");
        if (onSaved) onSaved();
      }
    });
  };

  /* Generic chain-link glyph, inlined as a data URI so a link whose favicon
     404s (or whose host blocks the favicon service) still gets *something*
     instead of a broken image icon. */
  const LINK_FALLBACK_ICON = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9aa3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>'
  );

  /* A link's site icon — YouTube's mark for a youtube.com link, GitHub's for
     github.com, etc. — resolved straight from the URL via App.u.faviconUrl,
     with the chain-link glyph above as the onerror fallback. */
  UI.linkFavicon = function (url, size, cls) {
    size = size || 16;
    const src = App.u.faviconUrl(url, Math.max(32, size * 2)) || LINK_FALLBACK_ICON;
    return '<img src="' + U().esc(src) + '" alt="" class="link-favicon' + (cls ? " " + cls : "") + '" width="' + size + '" height="' + size +
      '" onerror="this.onerror=null;this.src=\'' + LINK_FALLBACK_ICON + "'\">";
  };

  /* ---------------- exam-group badge ----------------
     Display-only — same badge look as banks (App.icon("layers") as the
     default mark). Groups have no per-badge click-to-edit; icon changes go
     through UI.editGroup instead, alongside the name. */
  UI.groupBadge = function (groupName, size, cls, attrs) {
    return UI.badgeHtml({
      icon: App.store.groupIcon(groupName),
      tone: App.store.groupTone(groupName),
      logo: App.store.groupLogo(groupName)
    }, size, cls, attrs);
  };

  /* ---------------- exam-group editor (name + icon, combined) ----------------
     One "Edit" entry point per group (card and detail page both use this)
     instead of separate rename / change-icon actions.
     `hooks.onSaved()` fires whenever anything is saved; `hooks.onRenamed(newName)`
     additionally fires only when the name actually changed, so a caller whose
     route embeds the group's name (the detail page) can navigate. */
  UI.editGroup = function (groupName, hooks) {
    hooks = hooks || {};
    const g = App.store.getGroup(groupName);
    UI.pickLook({
      title: "Edit group",
      subtitle: groupName,
      nameField: true,
      nameValue: groupName,
      descField: true,
      descValue: g && g.description,
      icon: App.store.groupIcon(groupName),
      tone: App.store.groupTone(groupName),
      logo: App.store.groupLogo(groupName),
      onSave: function (result) {
        App.store.setGroupLook(groupName, result.icon, result.tone, result.logo);
        App.store.setGroupDescription(groupName, result.description);
        let finalName = groupName;
        if (result.name && result.name !== groupName) {
          const res = App.store.renameGroup(groupName, result.name);
          if (res === null) UI.toast("That name is already taken — icon saved, name unchanged.", "err");
          else finalName = res;
        }
        if (finalName === groupName) {
          UI.toast("Group updated.", "ok");
          if (hooks.onSaved) hooks.onSaved();
        } else {
          UI.toast("Group updated.", "ok");
          if (hooks.onRenamed) hooks.onRenamed(finalName);
          else if (hooks.onSaved) hooks.onSaved();
        }
      }
    });
  };

  /* ---------------- exam-group member picker ----------------
     A bank belongs to at most one group, so checking it here for this group
     silently moves it out of whichever group (if any) it was already in. */
  UI.manageGroupMembers = function (groupName, onSaved) {
    const u = U(), store = App.store;
    const names = store.bankNames();

    function rowHtml(n) {
      const b = store.getBank(n);
      const inThis = b.examGroup === groupName;
      const otherGroup = b.examGroup && !inThis ? b.examGroup : null;
      return '<label class="gmember-row' + (inThis ? " on" : "") + '" data-search="' + u.esc(n.toLowerCase()) + '">' +
        '<input type="checkbox" data-bank="' + u.esc(n) + '"' + (inThis ? " checked" : "") + ">" +
        UI.bankBadge(n, 15, "sm") +
        '<span class="gmember-name">' + u.esc(n) + "</span>" +
        (otherGroup ? '<span class="gmember-note">in ' + u.esc(otherGroup) + "</span>" : "") +
        '<span class="gmember-check">' + App.icon("check", 12, 3) + "</span>" +
        "</label>";
    }

    const rows = names.length ? names.map(rowHtml).join("") : '<div class="glink-empty">No exam banks yet — import one first.</div>';

    const veil = openModal(
      '<div class="modal-head"><div>' +
      '<div class="modal-title">Manage banks</div>' +
      '<div class="modal-sub">' + u.esc(groupName) + "</div></div>" +
      '<button class="icon-btn" data-x>' + App.icon("x", 15) + "</button></div>" +
      (names.length > 6 ? '<input class="input" id="gmember-search" placeholder="Filter banks…" style="margin-bottom:10px">' : "") +
      '<div class="gmember-list">' + rows + "</div>" +
      '<div class="modal-foot">' +
      '<button class="btn btn-ghost" data-x>Cancel</button>' +
      '<button class="btn btn-primary" id="gmember-save">' + App.icon("check", 15) + "Save</button>" +
      "</div>"
    );

    veil.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = closeModal; });

    veil.querySelectorAll("[data-bank]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        cb.closest(".gmember-row").classList.toggle("on", cb.checked);
      });
    });

    const search = veil.querySelector("#gmember-search");
    if (search) {
      search.addEventListener("input", function () {
        const term = search.value.trim().toLowerCase();
        veil.querySelectorAll(".gmember-row").forEach(function (row) {
          row.style.display = (!term || row.dataset.search.indexOf(term) !== -1) ? "" : "none";
        });
      });
      search.focus();
    }

    veil.querySelector("#gmember-save").onclick = function () {
      veil.querySelectorAll("[data-bank]").forEach(function (cb) {
        const n = cb.dataset.bank;
        const b = store.getBank(n);
        if (!b) return;
        const inThis = b.examGroup === groupName;
        if (cb.checked && !inThis) store.setBankGroup(n, groupName);
        else if (!cb.checked && inThis) store.setBankGroup(n, null);
      });
      closeModal();
      UI.toast("Group membership updated.", "ok");
      if (onSaved) onSaved();
    };
  };

  /* ---------------- svg ring ---------------- */
  UI.ring = function (pct, size, stroke, colorVar) {
    pct = U().clamp(pct, 0, 100);
    const r = (size - stroke) / 2;
    const c = (2 * Math.PI * r).toFixed(1);
    const off = (c - (c * pct) / 100).toFixed(1);
    const color = colorVar || "var(--acc)";
    return (
      '<svg class="ring-svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '">' +
      '<circle class="ring-track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="' + stroke + '"/>' +
      '<circle class="ring-val" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke +
      '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off +
      '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>' +
      "</svg>"
    );
  };

  /* ---------------- sparkline ---------------- */
  UI.sparkline = function (values, w, h) {
    w = w || 96; h = h || 26;
    if (!values || !values.length) return "";
    const max = 100, min = 0;
    const stepX = values.length > 1 ? w / (values.length - 1) : w;
    const pts = values.map(function (v, i) {
      const x = (i * stepX).toFixed(1);
      const y = (h - 3 - ((v - min) / (max - min)) * (h - 6)).toFixed(1);
      return x + "," + y;
    });
    const last = pts[pts.length - 1].split(",");
    return (
      '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true">' +
      '<polyline points="' + pts.join(" ") + '" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.6" fill="var(--acc)"/>' +
      "</svg>"
    );
  };

  /* ---------------- question media ---------------- */
  /* Images, video and audio for a question — one implementation shared by the
     study, exam, review and results cards. Anything that fails to load hides
     itself rather than leaving a broken frame. */
  UI.media = function (q) {
    if (!q) return "";
    const u = U();
    const hide = " onerror=\"this.parentElement.style.display='none'\"";
    let html = "";

    (q.images || []).forEach(function (src) {
      html += '<div class="qcard-img"><img src="' + u.esc(src) + '" alt="Question graphic" loading="lazy"' + hide + "></div>";
    });
    (q.videos || []).forEach(function (src) {
      html += '<div class="qcard-video"><video controls playsinline preload="metadata" src="' + u.esc(src) + '"' + hide + "></video></div>";
    });
    (q.audios || []).forEach(function (src) {
      html += '<div class="qcard-audio"><audio controls preload="none" src="' + u.esc(src) + '"' + hide + "></audio></div>";
    });

    return html ? '<div class="q-media">' + html + "</div>" : "";
  };

  /* ---------------- question type chips ---------------- */
  UI.typeChip = function (type) {
    if (type === "multiple") return '<span class="chip chip-warn">' + App.icon("layers", 11, 2.2) + "Multi-choice</span>";
    if (type === "matching") return '<span class="chip chip-teal">' + App.icon("link", 11, 2.2) + "Matching</span>";
    return '<span class="chip chip-acc">' + App.icon("check", 11, 2.4) + "Single choice</span>";
  };

  UI.typeLabel = function (type) {
    return type === "multiple" ? "Multi-choice" : type === "matching" ? "Matching" : "Single choice";
  };

  /* ---------------- empty state ---------------- */
  UI.empty = function (opts) {
    return (
      '<div class="empty rise">' +
      '<div class="e-ico">' + App.icon(opts.icon || "book", 24) + "</div>" +
      '<div class="e-t">' + U().esc(opts.title || "Nothing here yet") + "</div>" +
      '<div class="e-s">' + U().esc(opts.desc || "") + "</div>" +
      (opts.actionsHtml ? '<div class="e-actions">' + opts.actionsHtml + "</div>" : "") +
      "</div>"
    );
  };

  /* ---------------- confetti (tiny canvas burst) ---------------- */
  UI.confetti = function () {
    let canvas = document.getElementById("confetti-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "confetti-canvas";
      document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return; // canvas unsupported — skip the celebration quietly
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const colors = ["#6366f1", "#8b5cf6", "#2ec58f", "#f0b429", "#2cc3d1", "#f16b80"];
    const parts = [];
    for (let i = 0; i < 140; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.35,
        y: innerHeight * 0.28,
        vx: (Math.random() - 0.5) * 11,
        vy: -(Math.random() * 10 + 4),
        s: Math.random() * 7 + 3,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.25,
        c: colors[(Math.random() * colors.length) | 0],
        o: 1
      });
    }
    let frames = 0;
    (function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      parts.forEach(function (p) {
        p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (frames > 55) p.o -= 0.03;
        if (p.y < canvas.height + 20 && p.o > 0) alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.o);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
        ctx.restore();
      });
      frames++;
      if (alive && frames < 200) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })();
  };

  App.ui = UI;
})();
