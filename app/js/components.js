/* ExamPro — shared reusable UI components (progressive-enhancement widgets).
 *
 * See app/js/UI-KIT.md for the full catalog of shared UI pieces (this file,
 * plus the helpers already living in ui.js) and when to reach for each one.
 */
window.App = window.App || {};

(function () {
  const Components = {};

  /* ---------------- themed dropdown ----------------
     Replaces a native <select class="select"> with a styled trigger + listbox
     that matches the app's dropdown menus (.menu-pop / .menu-item), while the
     original <select> stays in the DOM (hidden) as the single source of truth.
     Existing code that reads `sel.value` or listens for `sel.onchange` /
     `change` keeps working untouched — picking a custom option just sets
     `sel.selectedIndex` and dispatches a real "change" event. */
  Components.enhanceSelect = function (sel) {
    if (!sel || sel.tagName !== "SELECT" || sel.dataset.xsel === "1") return;
    sel.dataset.xsel = "1";

    const wrap = document.createElement("div");
    wrap.className = "xsel";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "xsel-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    label.className = "xsel-label";
    const chev = document.createElement("span");
    chev.className = "xsel-chev";
    chev.innerHTML = App.icon("chevDown", 15, 2.2);
    trigger.appendChild(label);
    trigger.appendChild(chev);

    const panel = document.createElement("div");
    panel.className = "xsel-panel";
    panel.setAttribute("role", "listbox");
    panel.tabIndex = -1;

    function paintTrigger() {
      const opt = sel.options[sel.selectedIndex];
      label.textContent = opt ? opt.textContent : "";
      trigger.classList.toggle("is-placeholder", !opt || !opt.value);
      trigger.disabled = sel.disabled;
    }

    function closePanel() {
      if (!panel.classList.contains("open")) return;
      panel.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("keydown", onDocKey, true);
    }

    function focusRow(i) {
      const rows = panel.children;
      if (rows[i]) rows[i].focus();
    }

    function focusStep(fromIndex, dir) {
      const rows = panel.children;
      if (!rows.length) return;
      let n = fromIndex;
      for (let steps = 0; steps < rows.length; steps++) {
        n = (n + dir + rows.length) % rows.length;
        if (!rows[n].classList.contains("is-disabled")) { rows[n].focus(); return; }
      }
    }

    function choose(i) {
      sel.selectedIndex = i;
      paintTrigger();
      closePanel();
      trigger.focus();
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function buildOptions() {
      panel.innerHTML = "";
      Array.prototype.forEach.call(sel.options, function (opt, i) {
        const row = document.createElement("div");
        row.className = "xsel-opt" + (i === sel.selectedIndex ? " on" : "") + (opt.disabled ? " is-disabled" : "");
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", i === sel.selectedIndex ? "true" : "false");
        row.tabIndex = opt.disabled ? -1 : 0;
        row.textContent = opt.textContent;
        if (!opt.disabled) {
          row.onclick = function () { choose(i); };
          row.onkeydown = function (e) {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(i); }
            else if (e.key === "ArrowDown") { e.preventDefault(); focusStep(i, 1); }
            else if (e.key === "ArrowUp") { e.preventDefault(); focusStep(i, -1); }
            else if (e.key === "Escape") { e.preventDefault(); closePanel(); trigger.focus(); }
            else if (e.key === "Tab") closePanel();
          };
        }
        panel.appendChild(row);
      });
    }

    function positionPanel() {
      const rect = trigger.getBoundingClientRect();
      const roomBelow = window.innerHeight - rect.bottom;
      panel.classList.toggle("flip", roomBelow < 220 && rect.top > roomBelow);
    }

    function openPanel() {
      document.querySelectorAll(".xsel-panel.open").forEach(function (p) { if (p !== panel) p.classList.remove("open"); });
      buildOptions();
      positionPanel();
      panel.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      document.addEventListener("mousedown", onDocDown, true);
      document.addEventListener("keydown", onDocKey, true);
      const cur = panel.querySelector(".xsel-opt.on:not(.is-disabled)") || panel.querySelector(".xsel-opt:not(.is-disabled)");
      if (cur) cur.focus(); else panel.focus();
    }

    function onDocDown(e) { if (!wrap.contains(e.target)) closePanel(); }
    function onDocKey(e) {
      if (e.key === "Escape") { closePanel(); trigger.focus(); }
      else if (e.key === "ArrowDown" && document.activeElement === trigger) { e.preventDefault(); focusRow(sel.selectedIndex >= 0 ? sel.selectedIndex : 0); }
    }

    trigger.onclick = function () {
      if (trigger.disabled) return;
      if (panel.classList.contains("open")) closePanel(); else openPanel();
    };

    /* repaint if something else changes the underlying select's value */
    sel.addEventListener("change", paintTrigger);

    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(trigger);
    wrap.appendChild(panel);
    wrap.appendChild(sel);
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");

    paintTrigger();
  };

  /* Enhance every plain <select class="select"> under root (defaults to the
     whole document) — call once after any view/modal renders its markup. */
  Components.enhanceSelects = function (root) {
    (root || document).querySelectorAll("select.select").forEach(Components.enhanceSelect);
  };

  App.components = Components;
})();
