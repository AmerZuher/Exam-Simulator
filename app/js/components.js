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

    /* The panel is a portal — a direct child of <body>, not of `wrap` — so
       its z-index is never trapped inside an ancestor's stacking context.
       Any card animated with the app's .rise entrance class ends up with a
       resolved `transform` (even though the keyframe settles on `none`,
       fill-mode "both" keeps the animation's computed value active), and
       ANY non-none transform forms a brand new stacking context — which
       would cap this panel's z-index at the *card's* level, letting a
       later sibling card paint over it. Living in <body> sidesteps that
       entirely and lines up with position:fixed using the trigger's own
       getBoundingClientRect(), which is viewport-relative regardless of
       which ancestors are scrolled or transformed. */
    const panel = document.createElement("div");
    panel.className = "xsel-panel";
    panel.setAttribute("role", "listbox");
    panel.tabIndex = -1;
    panel._xselOwner = sel;
    document.body.appendChild(panel);

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
      window.removeEventListener("scroll", closePanel, true);
      window.removeEventListener("resize", closePanel);
    }
    panel._xselClose = closePanel;

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

    /* The trigger already shows the placeholder text when nothing's picked
       yet, so repeating an empty-value option as a selectable row in the
       open list is pure clutter — skip it there. */
    function listedOptions() {
      const out = [];
      Array.prototype.forEach.call(sel.options, function (opt, i) {
        if (opt.value === "" && sel.options.length > 1) return;
        out.push({ opt: opt, index: i });
      });
      return out;
    }

    function buildOptions() {
      panel.innerHTML = "";
      listedOptions().forEach(function (entry, ri) {
        const opt = entry.opt, i = entry.index;
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
            else if (e.key === "ArrowDown") { e.preventDefault(); focusStep(ri, 1); }
            else if (e.key === "ArrowUp") { e.preventDefault(); focusStep(ri, -1); }
            else if (e.key === "Escape") { e.preventDefault(); closePanel(); trigger.focus(); }
            else if (e.key === "Tab") closePanel();
          };
        }
        panel.appendChild(row);
      });
    }

    /* Fixed positioning (viewport-relative, like getBoundingClientRect
       itself) so the panel lines up with the trigger no matter what
       ancestors are scrolled or transformed — see the portal note above.
       Width is never pinned to the trigger's own width: a narrow trigger
       (e.g. the Progress page's bank-scope select) next to a long option
       label used to force multi-line wrapping inside the row. Instead the
       panel grows to fit its longest row (min the trigger's width, so it
       never looks narrower than what it's opening from) up to the CSS
       max-width, where `.xsel-opt`'s ellipsis takes over. */
    function positionPanel() {
      const rect = trigger.getBoundingClientRect();
      panel.style.minWidth = rect.width + "px";
      const roomBelow = window.innerHeight - rect.bottom;
      const flip = roomBelow < 220 && rect.top > roomBelow;
      panel.classList.toggle("flip", flip);
      const maxLeft = window.innerWidth - panel.offsetWidth - 10;
      panel.style.left = Math.max(10, Math.min(rect.left, maxLeft)) + "px";
      if (flip) {
        panel.style.top = "";
        panel.style.bottom = (window.innerHeight - rect.top + 6) + "px";
      } else {
        panel.style.top = (rect.bottom + 6) + "px";
        panel.style.bottom = "";
      }
    }

    function openPanel() {
      document.querySelectorAll(".xsel-panel.open").forEach(function (p) { if (p !== panel) p.classList.remove("open"); });
      buildOptions();
      panel.classList.add("open");
      positionPanel();
      trigger.setAttribute("aria-expanded", "true");
      document.addEventListener("mousedown", onDocDown, true);
      document.addEventListener("keydown", onDocKey, true);
      /* the panel no longer lives inside the page's scroll container, so
         rather than track scroll position live, just close on any scroll
         or resize — simple and avoids ever showing it in a stale spot */
      window.addEventListener("scroll", closePanel, true);
      window.addEventListener("resize", closePanel);
      const cur = panel.querySelector(".xsel-opt.on:not(.is-disabled)") || panel.querySelector(".xsel-opt:not(.is-disabled)");
      if (cur) cur.focus(); else panel.focus();
    }

    function onDocDown(e) { if (!wrap.contains(e.target) && !panel.contains(e.target)) closePanel(); }
    function onDocKey(e) {
      if (e.key === "Escape") { closePanel(); trigger.focus(); }
      else if (e.key === "ArrowDown" && document.activeElement === trigger) {
        e.preventDefault();
        const cur = panel.querySelector(".xsel-opt.on:not(.is-disabled)") || panel.querySelector(".xsel-opt:not(.is-disabled)");
        if (cur) cur.focus();
      }
    }

    trigger.onclick = function () {
      if (trigger.disabled) return;
      if (panel.classList.contains("open")) closePanel(); else openPanel();
    };

    /* repaint if something else changes the underlying select's value */
    sel.addEventListener("change", paintTrigger);

    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(trigger);
    wrap.appendChild(sel);   // panel is already in <body> — see above
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");

    paintTrigger();
  };

  /* Each enhanced select's panel is portaled onto <body> (see above), so it
     outlives its own <select> once a view re-render replaces that select's
     subtree wholesale (root.innerHTML = ...). Sweep those orphans out
     before enhancing the new batch — cheap, and every view already calls
     enhanceSelects right after rendering, so this needs no extra hook. */
  function sweepOrphanPanels() {
    document.querySelectorAll(".xsel-panel").forEach(function (p) {
      if (!p._xselOwner || !document.contains(p._xselOwner)) p.remove();
    });
  }

  /* Enhance every plain <select class="select"> under root (defaults to the
     whole document) — call once after any view/modal renders its markup. */
  Components.enhanceSelects = function (root) {
    sweepOrphanPanels();
    (root || document).querySelectorAll("select.select").forEach(Components.enhanceSelect);
  };

  /* Closes every currently-open dropdown panel. A panel lives on <body>
     independent of its <select>'s own subtree (see the portal note above),
     so tearing down a modal that contains an open select — e.g. clicking
     Cancel while a dropdown is open — would otherwise strand it mid-air:
     still "open", still holding document/window listeners, sitting on top
     of whatever renders next. Call this before removing anything that might
     contain an open select. */
  Components.closeAllSelects = function () {
    document.querySelectorAll(".xsel-panel.open").forEach(function (p) {
      if (p._xselClose) p._xselClose();
    });
  };

  App.components = Components;
})();
