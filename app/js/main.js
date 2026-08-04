/* ExamPro — bootstrap: theme, accents, sidebar, global handlers, first run */
window.App = window.App || {};

(function () {
  const ACCENTS = {
    indigo: { a: "#6366f1", b: "#8b5cf6" },
    emerald: { a: "#10b981", b: "#14b8a6" },
    amber: { a: "#f59e0b", b: "#f97316" },
    rose: { a: "#f43f5e", b: "#ec4899" },
    cyan: { a: "#06b6d4", b: "#3b82f6" },
    purple: { a: "#a855f7", b: "#ec4899" }
  };

  const Main = {};

  function hexRgb(hex) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  Main.isHex = function (v) { return /^#?[0-9a-f]{6}$/i.test(String(v || "").trim()); };
  Main.normHex = function (v) {
    const s = String(v || "").trim().replace(/^#/, "");
    return "#" + s.toLowerCase();
  };

  /* Derive the companion colour for the accent gradient by nudging the hue
     forward — keeps a custom accent looking like the built-in pairs. */
  function companion(hex) {
    const [r, g, b] = hexRgb(hex).map(function (v) { return v / 255; });
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    h = (h + 28) % 360;                                   /* shift hue */
    const l2 = Math.min(0.72, l + 0.06);
    const c = (1 - Math.abs(2 * l2 - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l2 - c / 2;
    let rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return "#" + rgb.map(function (v) {
      return Math.round((v + m) * 255).toString(16).padStart(2, "0");
    }).join("");
  }

  /* The accent in force: a named preset, or the user's own colour. */
  Main.accentPair = function () {
    const s = App.store.state.settings;
    if (s.accent === "custom" && Main.isHex(s.accentCustom)) {
      const a = Main.normHex(s.accentCustom);
      return { a: a, b: companion(a) };
    }
    return ACCENTS[s.accent] || ACCENTS.indigo;
  };
  Main.ACCENTS = ACCENTS;

  /* Theme toggling lives in Settings now — this just applies the stored value. */
  Main.applyTheme = function () {
    const s = App.store.state.settings;
    document.body.dataset.theme = s.theme === "dark" ? "dark" : "light";
    Main.applyAccent();
  };

  Main.applyAccent = function () {
    const s = App.store.state.settings;
    const theme = Main.accentPair();
    const dark = document.body.dataset.theme === "dark";
    const [r, g, b] = hexRgb(theme.a);
    const root = document.documentElement.style;
    root.setProperty("--acc", theme.a);
    root.setProperty("--acc-2", theme.b);
    root.setProperty("--acc-rgb", r + "," + g + "," + b);
    root.setProperty("--acc-soft", "rgba(" + r + "," + g + "," + b + "," + (dark ? "0.18" : "0.11") + ")");
    root.setProperty("--acc-softer", "rgba(" + r + "," + g + "," + b + "," + (dark ? "0.10" : "0.06") + ")");
    root.setProperty("--acc-line", "rgba(" + r + "," + g + "," + b + "," + (dark ? "0.45" : "0.32") + ")");
    root.setProperty("--acc-glow", "0 8px " + (dark ? "26px" : "22px") + " -8px rgba(" + r + "," + g + "," + b + "," + (dark ? "0.6" : "0.55") + ")");
    /* the built-in favicon is drawn on the accent colour, so redraw it */
    if (App.branding) App.branding.apply();
  };

  Main.toggleTheme = function () {
    const s = App.store.state.settings;
    App.store.setSetting("theme", s.theme === "dark" ? "light" : "dark");
    Main.applyTheme();
  };

  Main.setTopbar = function (title, sub) {
    const t = document.getElementById("topbar-title");
    const s = document.getElementById("topbar-sub");
    if (t) t.textContent = title;
    if (s) s.textContent = sub;
    if (App.views.exam && App.views.exam.updateTopbar) App.views.exam.updateTopbar(location.hash.indexOf("#/exam") !== 0);
  };

  /* ---------------- sidebar ---------------- */
  Main.renderSidebar = function (activeName) {
    const nav = document.getElementById("side-nav");
    if (!nav) return;
    const store = App.store;
    const names = store.bankNames();
    const stats = store.globalStats();
    const session = store.state.session;

    let html = "";

    /* An exam left mid-session (accidental nav click, browser back, closed
       tab) is saved automatically, but the only way back to it used to be
       the Dashboard's resume banner — easy to lose track of from any other
       page. Surface it here too, wherever the user ends up. */
    if (session && activeName !== "exam" && (session.origin || store.getBank(session.bankKey))) {
      html += '<button class="nav-item nav-resume" id="nav-resume-exam">' +
        '<span class="nav-ico">' + App.icon("resume", 17) + '</span>' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Resume exam</span>' +
        '<span class="nav-pill pill-resume">' + (session.index + 1) + "/" + session.questions.length + "</span></button>";
    }

    html +=
      '<button class="nav-item' + (activeName === "dashboard" ? " active" : "") + '" data-nav="#/dashboard">' +
      '<span class="nav-ico">' + App.icon("dashboard", 17) + '</span><span>Dashboard</span>' +
      '<span class="nav-pill">' + stats.banks + "</span></button>" +
      '<button class="nav-item' + (activeName === "review" ? " active" : "") + '" data-nav="#/review">' +
      '<span class="nav-ico">' + App.icon("cards", 17) + '</span><span>Review</span>' +
      (stats.due ? '<span class="nav-pill pill-due">' + stats.due + "</span>" : "") + "</button>" +
      '<button class="nav-item' + (activeName === "progress" ? " active" : "") + '" data-nav="#/progress">' +
      '<span class="nav-ico">' + App.icon("chart", 17) + '</span><span>Progress</span>' +
      (stats.streak ? '<span class="nav-pill pill-streak">' + App.icon("flame", 9, 2.4) + stats.streak + "</span>" : "") + "</button>" +
      '<button class="nav-item' + (activeName === "import" ? " active" : "") + '" data-nav="#/import">' +
      '<span class="nav-ico">' + App.icon("upload", 17) + '</span><span>Import bank</span></button>' +
      '<button class="nav-item' + (activeName === "generator" ? " active" : "") + '" data-nav="#/generator">' +
      '<span class="nav-ico">' + App.icon("robot", 17) + '</span><span>AI Generator</span></button>' +
      '<button class="nav-item' + (activeName === "settings" ? " active" : "") + '" data-nav="#/settings">' +
      '<span class="nav-ico">' + App.icon("gear", 17) + '</span><span>Settings</span></button>';

    if (names.length) {
      html += '<div class="nav-label">Study — Q&amp;A preview</div>';
      names.slice(0, 6).forEach(function (n) {
        const bank = store.getBank(n);
        const count = bank.questions.length;
        html +=
          '<button class="nav-item' + (activeName === "study" && decodeURIComponent((location.hash.split("/study/")[1] || "")) === n ? " active" : "") + '" data-nav="#/study/' + encodeURIComponent(n) + '">' +
          '<span class="nav-ico">' + App.ui.bankBadge(n, 16) + "</span>" +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + App.u.esc(n) + "</span>" +
          '<span class="nav-pill">' + count + "</span></button>";
      });
      if (names.length > 6) {
        html += '<button class="nav-item" data-nav="#/dashboard"><span class="nav-ico">' + App.icon("dots", 16) + '</span><span>All ' + names.length + ' banks…</span></button>';
      }
    }
    nav.innerHTML = html;

    nav.querySelectorAll("[data-nav]").forEach(function (b) {
      b.onclick = function () { App.router.go(b.dataset.nav); };
    });
    const resumeBtn = document.getElementById("nav-resume-exam");
    if (resumeBtn) resumeBtn.onclick = function () { App.views.exam.resumeSession(); };

    /* add tooltips for collapsed mode */
    nav.querySelectorAll(".nav-item").forEach(function (b) {
      var text = b.textContent.trim().replace(/\d+\s*due$/, "").replace(/\d+$/, "").trim();
      if (text) b.setAttribute("data-tip", text);
    });
  };

  Main.closeSidebar = function () {
    const sb = document.getElementById("sidebar");
    const sc = document.getElementById("scrim");
    if (sb) sb.classList.remove("open");
    if (sc) sc.classList.remove("show");
    document.body.classList.remove("no-scroll");
  };

  /* ---------------- first run ---------------- */
  const SAMPLE_MD = [
    "### 1. True or False: ExamPro includes a dedicated page where you can preview every question together with its correct answers.",
    "- [ ] True",
    "- [ ] False",
    "",
    "### 2. Which of the following can you do from the Dashboard? (Select all that apply)",
    "- [ ] Start a timed, shuffled exam",
    "- [ ] Review attempt history and best scores",
    "- [ ] Rename or export a bank",
    "- [ ] Compile the Linux kernel",
    "",
    "### 3. Matching: Match each page with what it is for.",
    "- [ ] Taking timed simulations",
    "- [ ] Previewing questions with answers",
    "- [ ] Adding new markdown banks",
    "Definition A: Exam page",
    "Definition B: Study (Q&A preview) page",
    "Definition C: Import page",
    "",
    "### 4. During an exam, which keyboard key flags the current question for review?",
    "- [ ] F",
    "- [ ] Q",
    "- [ ] Z",
    "- [ ] Esc",
    "",
    "### 5. What happens to an unfinished exam if you leave or close the app?",
    "- [ ] It is lost forever",
    "- [ ] It is auto-saved and can be resumed from the Dashboard",
    "- [ ] It is emailed to you",
    "- [ ] It restarts from zero next time",
    "",
    "### 6. Choose the right word with the definition: the small star on each question in the Study page that tracks which questions you have fully learned.",
    "- [ ] Mastery star",
    "- [ ] Flag pole",
    "- [ ] Timer chip",
    "- [ ] Drop zone",
    "",
    "### Answer Key",
    "| Question Number | Correct Answer |",
    "| :-------------- | :------------- |",
    "| 1 | True |",
    "| 2 | • Start a timed, shuffled exam <br>• Review attempt history and best scores <br>• Rename or export a bank |",
    "| 3 | Taking timed simulations, Previewing questions with answers, Adding new markdown banks |",
    "| 4 | F |",
    "| 5 | It is auto-saved and can be resumed from the Dashboard |",
    "| 6 | Mastery star |"
  ].join("\n");

  function firstRun() {
    const store = App.store;
    if (store.bankNames().length) return;
    if (location.protocol === "file:") {
      /* offline: embed a tiny guided sample so the app demos itself */
      const res = App.parser.parse(SAMPLE_MD);
      if (res.questions.length) store.addBank("Welcome tour — sample bank", res.questions);
    } else if (App.views.dashboard && App.views.dashboard.loadSamples) {
      App.views.dashboard.loadSamples();
    }
  }

  /* ---------------- boot ---------------- */
  Main.boot = function () {
    App.store.load();

    /* the logo opens Settings, where theme and accent now live */
    const brandBtn = document.getElementById("brand-btn");
    if (brandBtn) brandBtn.onclick = function () { App.router.go("#/settings"); };

    /* sidebar collapse toggle */
    const toggleBtn = document.getElementById("sidebar-toggle");
    if (toggleBtn) toggleBtn.onclick = function () {
      const shell = document.querySelector(".shell");
      const collapsed = shell.classList.toggle("sb-collapsed");
      App.store.setSetting("sidebarCollapsed", collapsed);
    };

    /* apply persisted sidebar state */
    if (App.store.state.settings.sidebarCollapsed) {
      document.querySelector(".shell").classList.add("sb-collapsed");
    }

    /* floating tooltips for collapsed sidebar icons */
    var tipEl = null;
    document.addEventListener("mouseover", function (e) {
      var t = e.target.closest(".nav-item[data-tip]");
      if (!t || !document.querySelector(".shell.sb-collapsed")) { if (tipEl) { tipEl.remove(); tipEl = null; } return; }
      if (tipEl) { tipEl.remove(); tipEl = null; }
      tipEl = document.createElement("div");
      tipEl.className = "sidebar-float-tip";
      tipEl.textContent = t.getAttribute("data-tip");
      document.body.appendChild(tipEl);
    });
    document.addEventListener("mousemove", function (e) {
      var t = e.target.closest(".nav-item[data-tip]");
      if (!t || !document.querySelector(".shell.sb-collapsed")) { if (tipEl) { tipEl.remove(); tipEl = null; } return; }
      if (tipEl) { tipEl.style.left = (e.clientX + 14) + "px"; tipEl.style.top = (e.clientY - 28) + "px"; }
    });
    document.addEventListener("mouseout", function (e) {
      var t = e.relatedTarget && e.relatedTarget.closest(".nav-item[data-tip]");
      if (!t) { if (tipEl) { tipEl.remove(); tipEl = null; } }
    });

    /* hamburger / scrim (mobile) — body scroll is locked while the drawer is
       open so there's nothing scrolling behind the fixed sidebar for it to
       visually drift against. */
    const ham = document.getElementById("hamburger");
    if (ham) ham.onclick = function () {
      document.getElementById("sidebar").classList.add("open");
      document.getElementById("scrim").classList.add("show");
      document.body.classList.add("no-scroll");
    };
    const scrim = document.getElementById("scrim");
    if (scrim) scrim.onclick = Main.closeSidebar;

    /* exam pause button in topbar */
    const pauseBtn = document.getElementById("timer-pause-btn");
    if (pauseBtn) pauseBtn.onclick = function () { App.views.exam.togglePause(); };

    /* global drag & drop of markdown / JSON files */
    document.addEventListener("dragover", function (e) {
      if (e.target.closest && e.target.closest(".dropzone")) return;
      e.preventDefault();
    });
    document.addEventListener("drop", function (e) {
      if (e.target.closest && e.target.closest(".dropzone")) return;
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f || !/\.(md|txt|json)$/i.test(f.name)) return;

      /* both formats land in the importer so the diagnostics and the
         new-vs-append choice always apply — reuse its own file-loading path
         (title/format detection included) rather than duplicating it here. */
      App.router.go("#/import");
      setTimeout(function () { App.views.importer.loadDroppedFile(f); }, 60);
    });

    /* "/" focuses the study search box */
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && location.hash.indexOf("#/study") === 0 && !(e.target.matches && e.target.matches("input,textarea,select"))) {
        e.preventDefault();
        const s = document.getElementById("study-search");
        if (s) s.focus();
      }
    });

    /* warn before unload while a session exists */
    window.addEventListener("beforeunload", function (e) {
      if (App.store.state.session && location.hash.indexOf("#/exam") === 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    /* global keyboard shortcuts */
    document.addEventListener("keydown", function (e) {
      /* the palette is reachable from anywhere, including inside inputs */
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        App.palette.toggle();
        return;
      }
      if (App.palette.isOpen()) return;
      if (e.target.matches && e.target.matches("input,textarea,select")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const inExam = location.hash.indexOf("#/exam") === 0;
      if (e.key === "?") { e.preventDefault(); Main.showHelp(); return; }
      if (inExam) return;                       /* exam owns its own keys */

      const jump = { d: "#/dashboard", i: "#/import", p: "#/progress", r: "#/review", s: "#/settings" };
      const to = jump[e.key.toLowerCase()];
      if (to) { e.preventDefault(); App.router.go(to); }
    });

    Main.showHelp = function () {
      const v = document.createElement("div");
      v.className = "help-veil";
      v.id = "help-veil";
      v.innerHTML =
        '<div class="help-card">' +
        '<h3>' + App.icon("sparkle", 16) + ' Keyboard shortcuts</h3>' +
        '<div class="help-sub">Anywhere</div>' +
        '<div class="help-grid">' +
        '<kbd>Ctrl</kbd><span>+ <kbd>K</kbd> — command palette</span>' +
        '<kbd>?</kbd><span>Open this help overlay</span>' +
        '<kbd>D</kbd><span>Dashboard</span>' +
        '<kbd>R</kbd><span>Review (flashcards)</span>' +
        '<kbd>P</kbd><span>Progress &amp; analytics</span>' +
        '<kbd>I</kbd><span>Import</span>' +
        '<kbd>S</kbd><span>Settings</span>' +
        '<kbd>/</kbd><span>Search in Study view</span>' +
        '</div>' +
        '<div class="help-sub">During an exam</div>' +
        '<div class="help-grid">' +
        '<kbd>→</kbd><span>Next question</span>' +
        '<kbd>←</kbd><span>Previous question</span>' +
        '<kbd>1-9</kbd><span>Select answer option</span>' +
        '<kbd>F</kbd><span>Flag / unflag question</span>' +
        '<kbd>Enter</kbd><span>Next / Submit exam</span>' +
        '</div>' +
        '<div class="help-sub">Reviewing flashcards</div>' +
        '<div class="help-grid">' +
        '<kbd>Space</kbd><span>Flip the card</span>' +
        '<kbd>1</kbd><span>Again — I blanked</span>' +
        '<kbd>2</kbd><span>Hard — recalled with effort</span>' +
        '<kbd>3</kbd><span>Good — recalled it</span>' +
        '<kbd>4</kbd><span>Easy — instant</span>' +
        '</div>' +
        '<button class="btn btn-primary" id="help-close">Got it</button>' +
        '</div>';
      document.body.appendChild(v);
      v.querySelector("#help-close").onclick = function () { v.remove(); };
      v.addEventListener("mousedown", function (e) { if (e.target === v) v.remove(); });
    };

    Main.applyTheme();
    App.branding.apply();
    firstRun();
    App.router.start();
  };

  App.main = Main;
  window.addEventListener("DOMContentLoaded", Main.boot);
})();
