/* ExamPro — command palette (Ctrl/Cmd+K).
 *
 * Indexes navigation targets, per-bank actions, theme/accent switches and every
 * question in every bank, then subsequence-matches the typed query against them.
 * Selecting a question jumps to the Study page with that question searched for.
 */
window.App = window.App || {};

(function () {
  const P = {};
  let veil = null;
  let items = [];
  let shown = [];
  let cursor = 0;

  /* ---------------- fuzzy matching ---------------- */

  /* Subsequence match with a score: contiguous runs and word-start hits win. */
  function score(text, q) {
    const t = text.toLowerCase();
    const n = q.length;
    if (!n) return 1;
    const direct = t.indexOf(q);
    if (direct === 0) return 1000;
    if (direct > 0) return 700 - Math.min(direct, 200) + (/[\s\-–—:·]/.test(t[direct - 1]) ? 120 : 0);

    let ti = 0, s = 0, run = 0;
    for (let i = 0; i < n; i++) {
      const at = t.indexOf(q[i], ti);
      if (at === -1) return 0;
      run = at === ti && i > 0 ? run + 1 : 0;
      s += 10 + run * 6 + (at === 0 || /[\s\-–—:·]/.test(t[at - 1]) ? 8 : 0);
      ti = at + 1;
    }
    return s - Math.min(t.length / 4, 40);
  }

  /* ---------------- index ---------------- */

  function build() {
    const store = App.store, srs = App.srs;
    const list = [];
    const names = store.bankNames();

    list.push(
      { group: "Go", icon: "dashboard", title: "Dashboard", hint: "D", run: function () { App.router.go("#/dashboard"); } },
      { group: "Go", icon: "chart", title: "Progress & analytics", hint: "P", run: function () { App.router.go("#/progress"); } },
      { group: "Go", icon: "cards", title: "Review — flashcards", hint: "R", run: function () { App.router.go("#/review"); } },
      { group: "Go", icon: "upload", title: "Import a question bank", hint: "I", run: function () { App.router.go("#/import"); } },
      { group: "Go", icon: "gear", title: "Settings", hint: "S", run: function () { App.router.go("#/settings"); } }
    );

    const totalDue = names.reduce(function (s, n) { return s + srs.dueCount(n); }, 0);
    if (totalDue) {
      const target = names.filter(function (n) { return srs.dueCount(n); })[0];
      list.push({
        group: "Action", icon: "bolt", title: "Review everything due",
        sub: totalDue + " card" + (totalDue === 1 ? "" : "s") + " waiting",
        run: function () { App.views.review.start(target, { size: App.store.state.settings.reviewSize || 20 }); }
      });
    }
    if (names.length > 1) {
      list.push({ group: "Action", icon: "layers", title: "Build a custom exam", sub: "Mix several banks", run: function () { App.views.exam.openBuilder(); } });
    }
    list.push(
      { group: "Action", icon: "robot", title: "Open AI Exam Generator", run: function () { App.router.go("#/generator"); } },
      { group: "Action", icon: "sparkle", title: "Keyboard shortcuts", hint: "?", run: function () { App.main.showHelp(); } },
      {
        group: "Action",
        icon: store.state.settings.theme === "dark" ? "sun" : "moon",
        title: "Switch to " + (store.state.settings.theme === "dark" ? "light" : "dark") + " mode",
        run: function () { App.main.toggleTheme(); }
      }
    );

    names.forEach(function (n) {
      const st = store.bankStats(n);
      const sub = st.count + " questions" + (st.due ? " · " + st.due + " due" : "");
      const bankIcon = store.bankIcon(n);
      list.push(
        { group: "Exam", icon: bankIcon, title: "Exam: " + n, sub: sub, run: function () { App.views.exam.openSetup(n); } },
        { group: "Study", icon: bankIcon, title: "Study: " + n, sub: sub, run: function () { App.router.go("#/study/" + encodeURIComponent(n)); } },
        { group: "Review", icon: bankIcon, title: "Review: " + n, sub: sub, run: function () { App.views.review.start(n, { size: App.store.state.settings.reviewSize || 20 }); } }
      );
    });

    ["indigo", "cyan", "emerald", "amber", "rose", "purple"].forEach(function (a) {
      list.push({
        group: "Theme", icon: "sparkle", title: "Accent: " + a.charAt(0).toUpperCase() + a.slice(1),
        run: function () { store.setSetting("accent", a); App.main.applyAccent(); }
      });
    });

    /* questions — only searched once the query is long enough to be meaningful */
    names.forEach(function (n) {
      store.getBank(n).questions.forEach(function (q) {
        list.push({
          group: "Question", icon: "search", title: q.question, sub: n, deep: true,
          run: function () {
            App.router.go("#/study/" + encodeURIComponent(n));
            setTimeout(function () {
              const s = document.getElementById("study-search");
              if (s) { s.value = q.question.slice(0, 48); s.dispatchEvent(new Event("input")); s.focus(); }
            }, 80);
          }
        });
      });
    });

    return list;
  }

  /* ---------------- rendering ---------------- */

  function rank(q) {
    const query = q.trim().toLowerCase();
    if (!query) return items.filter(function (i) { return !i.deep; }).slice(0, 12);
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.deep && query.length < 3) continue;
      const s = score(it.title, query) + (it.sub ? score(it.sub, query) * 0.25 : 0);
      if (s > 0) out.push({ it: it, s: s - (it.deep ? 120 : 0) });
    }
    out.sort(function (a, b) { return b.s - a.s; });
    return out.slice(0, 40).map(function (r) { return r.it; });
  }

  function paint(query) {
    shown = rank(query);
    cursor = 0;
    const box = veil.querySelector("#cp-results");
    box.textContent = "";

    if (!shown.length) {
      const e = document.createElement("div");
      e.className = "cp-empty";
      e.textContent = "Nothing matches “" + query + "”.";
      box.appendChild(e);
      return;
    }

    let lastGroup = null;
    shown.forEach(function (it, i) {
      if (it.group !== lastGroup) {
        lastGroup = it.group;
        const h = document.createElement("div");
        h.className = "cp-group";
        h.textContent = it.group;
        box.appendChild(h);
      }
      const row = document.createElement("button");
      row.className = "cp-item" + (i === 0 ? " on" : "");
      row.dataset.i = i;
      row.innerHTML = '<span class="cp-ico">' + App.icon(it.icon || "arrowR", 15) + "</span>";

      const body = document.createElement("span");
      body.className = "cp-body";
      const t = document.createElement("span");
      t.className = "cp-title";
      t.textContent = it.title;                       /* untrusted bank/question text */
      body.appendChild(t);
      if (it.sub) {
        const s = document.createElement("span");
        s.className = "cp-sub";
        s.textContent = it.sub;
        body.appendChild(s);
      }
      row.appendChild(body);

      if (it.hint) {
        const k = document.createElement("kbd");
        k.textContent = it.hint;
        row.appendChild(k);
      }
      row.onclick = function () { pick(i); };
      row.onmousemove = function () { move(i, true); };
      box.appendChild(row);
    });
  }

  function move(i, silent) {
    if (!shown.length) return;
    cursor = (i + shown.length) % shown.length;
    const rows = veil.querySelectorAll(".cp-item");
    rows.forEach(function (r) { r.classList.toggle("on", parseInt(r.dataset.i, 10) === cursor); });
    if (!silent) {
      const on = veil.querySelector(".cp-item.on");
      if (on) on.scrollIntoView({ block: "nearest" });
    }
  }

  function pick(i) {
    const it = shown[i];
    if (!it) return;
    P.close();
    setTimeout(function () { it.run(); }, 10);
  }

  /* ---------------- open / close ---------------- */

  P.open = function () {
    if (veil) { P.close(); return; }
    items = build();

    veil = document.createElement("div");
    veil.className = "cp-veil";
    veil.innerHTML =
      '<div class="cp-panel" role="dialog" aria-modal="true" aria-label="Command palette">' +
      '<div class="cp-input-row">' + App.icon("search", 17) +
      '<input id="cp-input" class="cp-input" placeholder="Search banks, questions and actions…" autocomplete="off" spellcheck="false">' +
      '<kbd class="cp-esc">Esc</kbd></div>' +
      '<div class="cp-results" id="cp-results"></div>' +
      '<div class="cp-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span>' +
      "<span>type 3+ letters to search question text</span></div>" +
      "</div>";
    document.body.appendChild(veil);

    const input = veil.querySelector("#cp-input");
    paint("");
    input.focus();

    input.addEventListener("input", function () { paint(input.value); });
    veil.addEventListener("mousedown", function (e) { if (e.target === veil) P.close(); });
    veil.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); P.close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); move(cursor + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(cursor - 1); }
      else if (e.key === "Enter") { e.preventDefault(); pick(cursor); }
    });
  };

  P.close = function () {
    if (!veil) return;
    veil.remove();
    veil = null;
    shown = [];
  };

  P.toggle = function () { if (veil) P.close(); else P.open(); };
  P.isOpen = function () { return !!veil; };

  App.palette = P;
})();
