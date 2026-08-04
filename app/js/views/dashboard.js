/* ExamPro - Dashboard view */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Dashboard", sub: "Your exam banks at a glance" };

  View.render = function (root) {
    const u = App.u, store = App.store, ui = App.ui;
    const stats = store.globalStats();
    const names = store.bankNames();
    const ungrouped = store.ungroupedBankNames();
    const groupNames = store.groupNames();
    const session = store.state.session;
    const isServed = location.protocol !== "file:";

    let html = "";

    /* hero */
    html +=
      '<section class="hero rise">' +
      '<span class="hero-kicker">' + App.icon("bolt", 13, 2.2) + "Exam Simulator Suite</span>" +
      "<h2>Practice. Preview. Master every question.</h2>" +
      "<p>Import markdown question banks, drill them in the interactive simulator, or flip open the instant Q&amp;A study preview \u2014 with attempt history, mastery tracking and smart parsing built in.</p>" +
      '<div class="hero-actions">' +
      '<button class="btn btn-light" data-act="import">' + App.icon("upload", 16) + "Import question bank</button>" +
      '<button class="btn btn-light" data-act="builder">' + App.icon("layers", 16) + "Custom exam</button>" +
      '<button class="btn btn-ghost" data-act="new-group">' + App.icon("layers", 16) + "Create group</button>" +
      '<button class="btn btn-ghost" data-act="ai">' + App.icon("robot", 16) + "Generate with AI</button>" +
      (isServed && !names.length ? '<button class="btn btn-ghost" data-act="samples">' + App.icon("sparkle", 16) + "Load sample banks</button>" : "") +
      "</div></section>" +
      todayHtml(stats);

    /* resume banner */
    if (session && store.getBank(session.bankKey)) {
      const answered = Object.keys(session.responses || {}).length;
      html +=
        '<section class="resume-banner rise" style="margin-top:18px;animation-delay:.05s">' +
        '<div class="rb-ico">' + App.icon("history", 20) + "</div>" +
        '<div style="min-width:0"><div class="rb-t">Exam in progress: ' + u.esc(session.bankKey) + "</div>" +
        '<div class="rb-s">Question ' + (session.index + 1) + " of " + session.questions.length + " \u00b7 " + answered + " answered \u00b7 " + u.fmtClock(session.seconds) + " elapsed</div></div>" +
        '<div style="margin-left:auto;display:flex;gap:8px">' +
        '<button class="btn btn-danger btn-sm" data-act="discard-session">Discard</button>' +
        '<button class="btn btn-primary btn-sm" data-act="resume-session">' + App.icon("resume", 14) + "Resume exam</button>" +
        "</div></section>";
    }

    /* stats */
    html +=
      '<section class="stat-grid" style="margin-top:22px">' +
      statTile("book", stats.banks, "Exam banks", 0) +
      statTile("layers", stats.questions, "Total questions", 1) +
      statTile("chart", stats.attempts, "Attempts taken", 2) +
      statTile("target", stats.avg, "Average score", 3, "%") +
      "</section>";

    /* today's plan */
    if (names.length) {
      html += '<div class="sec-head" style="margin-top:26px"><h3>Today</h3>' +
        '<div class="sec-actions"><button class="btn btn-ghost btn-sm" data-act="progress">' + App.icon("chart", 14) + "Full progress</button></div></div>" +
        planHtml();
    }

    /* exam groups */
    html +=
      '<div class="sec-head"><h3>Exam Groups</h3>' +
      (groupNames.length ? '<span class="count-badge">' + groupNames.length + " total</span>" : "") +
      '<div class="sec-actions"><button class="btn btn-ghost btn-sm" data-act="new-group">' + App.icon("layers", 14) + "New group</button></div></div>";

    if (!groupNames.length) {
      html += App.ui.empty({
        icon: "layers",
        title: "No exam groups yet",
        desc: "Bundle related exam banks — like everything under one certification track — into a group with shared progress and reference links.",
        actionsHtml: '<button class="btn btn-primary" data-act="new-group">' + App.icon("layers", 15) + "Create a group</button>"
      });
    } else {
      html += '<div class="group-grid">';
      groupNames.forEach(function (name, i) { html += groupCard(name, i); });
      html += "</div>";
    }

    /* banks (ungrouped only — a bank in a group only ever appears there) */
    html +=
      '<div class="sec-head" style="margin-top:34px"><h3>Exam banks</h3><span class="count-badge">' + ungrouped.length + " total</span>" +
      '<div class="sec-actions"><button class="btn btn-ghost btn-sm" data-act="import">' + App.icon("upload", 14) + "Import</button></div></div>";

    if (!names.length) {
      html += App.ui.empty({
        icon: "book",
        title: "No question banks yet",
        desc: "Drag a markdown (.md) file anywhere onto this page, or use the importer to paste questions and build your first bank.",
        actionsHtml:
          '<button class="btn btn-primary" data-act="import">' + App.icon("upload", 15) + "Open importer</button>" +
          (isServed ? '<button class="btn btn-ghost" data-act="samples">' + App.icon("sparkle", 15) + "Load bundled samples</button>" : "")
      });
    } else if (!ungrouped.length) {
      html += App.ui.empty({
        icon: "check",
        title: "All banks are organized into groups",
        desc: "Every exam bank you have belongs to a group above. Remove one from its group to see it here.",
        actionsHtml: '<button class="btn btn-ghost" data-act="import">' + App.icon("upload", 15) + "Import another bank</button>"
      });
    } else {
      html += '<div class="bank-grid">';
      ungrouped.forEach(function (name, i) { html += bankCard(name, i); });
      html += "</div>";
    }

    root.innerHTML = '<div class="view">' + html + "</div>";

    /* count-up animation */
    root.querySelectorAll("[data-count]").forEach(function (el) {
      App.u.countUp(el, parseFloat(el.dataset.count), { suffix: el.dataset.suffix || "", duration: 850 });
    });

    wire(root.firstElementChild);
  };

  /* Streak + daily-goal ribbon under the hero. */
  function todayHtml(stats) {
    const srs = App.srs;
    const goal = App.store.state.settings.dailyGoal || 20;
    const today = srs.dayStats();
    const pct = Math.min(100, Math.round((today.answered / goal) * 100));
    const streak = stats.streak;

    return (
      '<section class="today-strip rise" style="animation-delay:.04s">' +
      '<div class="ts-flame' + (streak ? " lit" : "") + '">' + App.icon("flame", 20) +
      '<span class="ts-streak">' + streak + "</span></div>" +
      '<div class="ts-body"><div class="ts-t">' +
      (streak > 1 ? streak + "-day streak" : streak === 1 ? "Streak started today" : "No streak yet") +
      "</div>" +
      '<div class="ts-s">' + today.answered + " of " + goal + " questions today" +
      (stats.due ? " · " + stats.due + " card" + (stats.due === 1 ? "" : "s") + " due" : " · nothing due") + "</div>" +
      '<div class="ts-track"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="ts-actions">' +
      (stats.due
        ? '<button class="btn btn-primary btn-sm" data-act="review-due">' + App.icon("cards", 14) + "Start review</button>"
        : '<button class="btn btn-soft btn-sm" data-act="review-any">' + App.icon("cards", 14) + "Study ahead</button>") +
      "</div></section>"
    );
  }

  /* Three suggested next actions, ordered by what the data says matters. */
  function planHtml() {
    const store = App.store, srs = App.srs, u = App.u;
    const names = store.bankNames();
    const cards = [];

    const dueBank = names.filter(function (n) { return srs.dueCount(n); })
      .sort(function (a, b) { return srs.dueCount(b) - srs.dueCount(a); })[0];
    if (dueBank) {
      cards.push({
        icon: "cards", tone: "acc",
        title: srs.dueCount(dueBank) + " cards due",
        desc: "in " + u.esc(dueBank) + " — the scheduler picked these for today.",
        cta: "Review now", act: "review-bank", key: dueBank
      });
    }

    const weak = srs.weakest(null, 5);
    if (weak.length >= 3) {
      cards.push({
        icon: "bolt", tone: "warn",
        title: weak.length + " weak spots",
        desc: "Questions you keep getting wrong across your banks.",
        cta: "Drill them", act: "drill-weak"
      });
    }

    const untouched = names.filter(function (n) { return !(store.state.history[n] || []).length; })[0];
    if (untouched) {
      cards.push({
        icon: "play", tone: "teal",
        title: "Never examined",
        desc: u.esc(untouched) + " has no attempts yet — get a baseline score.",
        cta: "Take it", act: "start", key: untouched
      });
    } else {
      const lowest = names.map(function (n) { return { n: n, st: store.bankStats(n) }; })
        .filter(function (x) { return x.st.attempts; })
        .sort(function (a, b) { return a.st.best - b.st.best; })[0];
      if (lowest) {
        cards.push({
          icon: "target", tone: "teal",
          title: "Lowest best score: " + lowest.st.best + "%",
          desc: u.esc(lowest.n) + " is your weakest bank overall.",
          cta: "Retake", act: "start", key: lowest.n
        });
      }
    }

    if (!cards.length) {
      cards.push({
        icon: "check", tone: "ok",
        title: "All caught up",
        desc: "Nothing due, nothing flagged. Study ahead or import something new.",
        cta: "Import", act: "import"
      });
    }

    return '<div class="plan-grid">' + cards.map(function (c, i) {
      return '<article class="plan-card tone-' + c.tone + ' rise" style="animation-delay:' + (0.05 + i * 0.05) + 's">' +
        '<div class="pc-ico">' + App.icon(c.icon, 18) + "</div>" +
        '<div class="pc-t">' + App.u.esc(c.title) + "</div>" +
        '<div class="pc-d">' + c.desc + "</div>" +
        '<button class="btn btn-soft btn-sm" data-act="' + c.act + '"' + (c.key ? ' data-key="' + App.u.esc(c.key) + '"' : "") + ">" +
        c.cta + App.icon("arrowR", 13) + "</button></article>";
    }).join("") + "</div>";
  }

  function statTile(icon, val, label, i, suffix) {
    return (
      '<div class="stat-tile rise" style="animation-delay:' + (0.05 + i * 0.05) + 's">' +
      '<div class="stat-ico">' + App.icon(icon, 17) + "</div>" +
      '<div class="stat-num" data-count="' + val + '" data-suffix="' + (suffix || "") + '">0</div>' +
      '<div class="stat-lbl">' + label + "</div></div>"
    );
  }

  function bankCard(name, i) {
    const u = App.u, store = App.store, ui = App.ui;
    const st = store.bankStats(name);
    const masteryPct = st.count ? Math.round((st.mastered / st.count) * 100) : 0;
    const chips =
      (st.types.single ? '<span class="chip chip-acc">' + st.types.single + " single</span>" : "") +
      (st.types.multiple ? '<span class="chip chip-warn">' + st.types.multiple + " multi</span>" : "") +
      (st.types.matching ? '<span class="chip chip-teal">' + st.types.matching + " match</span>" : "");
    const sparkVals = st.history.slice(-10).map(function (a) { return a.pct; });

    return (
      '<article class="card card-hover bank-card rise" style="animation-delay:' + (0.08 + i * 0.05) + 's">' +
      '<div class="bank-top">' +
      ui.editableBankBadge(name, 20) +
      '<div style="min-width:0"><div class="bank-name">' + u.esc(name) + "</div>" +
      '<div class="bank-meta">' + st.count + " questions" + (st.attempts ? " \u00b7 " + st.attempts + " attempt" + (st.attempts > 1 ? "s" : "") : " \u00b7 not attempted yet") + "</div></div>" +
      '<div class="bank-menu"><button class="icon-btn" data-menu="' + u.esc(name) + '" aria-label="Bank options">' + App.icon("dots", 16) + "</button></div>" +
      "</div>" +
      '<div class="type-chips">' + chips + "</div>" +
      '<div title="Mastery: ' + st.mastered + " of " + st.count + ' starred · Retention: questions scheduled a week or more out">' +
      '<div style="display:flex;justify-content:space-between;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:5px">' +
      "<span>Mastery " + masteryPct + "%</span><span>Retention " + st.retention + "%</span></div>" +
      '<div class="mastery-bar"><i style="width:' + masteryPct + '%"></i>' +
      '<b class="retain-mark" style="left:' + st.retention + '%"></b></div>' +
      "</div>" +
      '<div class="bank-foot">' +
      '<div class="bank-best">' + (st.attempts
        ? App.icon("target", 14) + "<span>Best&nbsp;<b style='color:var(--ink)'>" + st.best + "%</b></span>" + (sparkVals.length > 1 ? '<span style="margin-left:4px">' + ui.sparkline(sparkVals, 72, 22) + "</span>" : "")
        : App.icon("sparkle", 14) + "<span>Ready when you are</span>") + "</div>" +
      '<div class="bank-actions">' +
      '<button class="icon-btn" data-act="study" data-key="' + u.esc(name) + '" title="Q&amp;A preview" aria-label="Study ' + u.esc(name) + '">' + App.icon("study", 15) + "</button>" +
      '<button class="btn btn-soft btn-sm" data-act="review" data-key="' + u.esc(name) + '">' + App.icon("cards", 13) + "Review" +
      (st.due ? '<span class="btn-badge">' + st.due + "</span>" : "") + "</button>" +
      '<button class="btn btn-primary btn-sm" data-act="start" data-key="' + u.esc(name) + '">' + App.icon("play", 13) + "Exam</button>" +
      "</div></div></article>"
    );
  }

  /* Every group card is the same width/height no matter how much content it
     holds — no bank-name chips (those live only on the detail page), and the
     links row is a fixed-height slot rather than something that grows the
     card when a group happens to have more references. */
  function groupCard(name, i) {
    const u = App.u, store = App.store, ui = App.ui;
    const g = store.getGroup(name);
    const st = store.groupStats(name);
    const desc = (g && g.description) || "";

    const links = (g && g.links) || [];
    const linksRow = links.map(function (l) {
      return '<a class="group-link-pill" href="' + u.esc(l.url) + '" target="_blank" rel="noopener noreferrer" title="' + u.esc(l.label) + '">' +
        ui.linkFavicon(l.url, 17) + u.esc(l.label) + "</a>";
    }).join("");

    return (
      '<article class="card card-hover group-card rise" style="animation-delay:' + (0.08 + i * 0.05) + 's">' +
      '<div class="bank-top">' +
      ui.groupBadge(name, 20) +
      '<div style="min-width:0"><div class="bank-name">' + u.esc(name) + "</div>" +
      '<div class="group-meta-row">' +
      '<span class="group-meta-item">' + App.icon("book", 12, 2.2) + "<b>" + st.banks + "</b> exam" + (st.banks === 1 ? "" : "s") + "</span>" +
      '<span class="group-meta-item">' + App.icon("layers", 12, 2.2) + "<b>" + st.questions + "</b> question" + (st.questions === 1 ? "" : "s") + "</span>" +
      "</div></div>" +
      '<div class="bank-menu">' +
      '<button class="icon-btn" data-gedit="' + u.esc(name) + '" title="Edit group" aria-label="Edit group">' + App.icon("edit", 15) + "</button>" +
      "</div></div>" +
      '<div class="group-desc' + (desc ? "" : " is-blank") + '">' + (desc ? u.esc(desc) : "No description added.") + "</div>" +
      '<div title="Combined mastery and retention across every bank in this group">' +
      '<div style="display:flex;justify-content:space-between;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:5px">' +
      "<span>Mastery " + st.masteryPct + "%</span><span>Retention " + st.retention + "%</span></div>" +
      '<div class="mastery-bar"><i style="width:' + st.masteryPct + '%"></i>' +
      '<b class="retain-mark" style="left:' + st.retention + '%"></b></div>' +
      "</div>" +
      '<div class="bank-foot">' +
      '<div class="group-links-row">' + linksRow + "</div>" +
      '<div class="bank-actions">' +
      '<button class="btn btn-primary btn-sm" data-act="open-group" data-key="' + u.esc(name) + '" style="flex:1;justify-content:center">' + App.icon("arrowR", 13) + "Open group</button>" +
      "</div></div></article>"
    );
  }

  function closeMenus() { document.querySelectorAll(".menu-pop").forEach(function (m) { m.remove(); }); }

  /* Bank-card behaviour (badges, study/review/start, the "..." dropdown) \u2014
     shared by the Dashboard's own bank-grid and the Exam Group detail page's
     filtered bank-grid, since both render identical bankCard() markup. */
  function wireBankGrid(wrap, rerender) {
    const u = App.u, store = App.store, ui = App.ui;

    ui.wireBankBadges(wrap, function () { rerender(); App.main.renderSidebar(App.router.currentName); });

    App.u.on(wrap, "click", "[data-act]", function (e, el) {
      const act = el.dataset.act, key = el.dataset.key;
      if (act === "start") App.views.exam.openSetup(key);
      else if (act === "study") App.router.go("#/study/" + encodeURIComponent(key));
      else if (act === "review" || act === "review-bank") App.views.review.start(key, {});
    });

    /* bank card dropdown menus */
    App.u.on(wrap, "click", "[data-menu]", function (e, el) {
      e.stopPropagation();
      const name = el.dataset.menu;
      closeMenus();
      const pop = document.createElement("div");
      pop.className = "menu-pop";
      pop.innerHTML =
        '<button class="menu-item" data-m="rename">' + App.icon("edit", 14) + "Rename bank</button>" +
        '<button class="menu-item" data-m="icon">' + App.icon("palette", 14) + "Change icon</button>" +
        '<button class="menu-item" data-m="export">' + App.icon("download", 14) + "Export as JSON</button>" +
        '<button class="menu-item danger" data-m="delete">' + App.icon("trash", 14) + "Delete bank</button>";
      el.parentElement.appendChild(pop);
      pop.querySelector('[data-m="icon"]').onclick = function () {
        closeMenus();
        ui.pickBankLook(name, rerender);
      };
      pop.querySelector('[data-m="rename"]').onclick = function () {
        closeMenus();
        ui.prompt({ title: "Rename bank", desc: "Give this question bank a new name.", value: name, confirmLabel: "Rename" }, function (v) {
          const res = store.renameBank(name, v);
          if (res === null) ui.toast("That name is already taken.", "err");
          else { ui.toast("Bank renamed to \u201C" + res + "\u201D.", "ok"); rerender(); App.main.renderSidebar(App.router.currentName); }
        });
      };
      pop.querySelector('[data-m="export"]').onclick = function () {
        closeMenus();
        const bank = store.getBank(name);
        App.u.download(App.u.slugFile(name) + ".json", JSON.stringify({ name: name, exportedAt: new Date().toISOString(), questions: bank.questions }, null, 2));
        ui.toast("Bank exported as JSON.", "ok");
      };
      pop.querySelector('[data-m="delete"]').onclick = function () {
        closeMenus();
        ui.confirm({ title: 'Delete "' + name + '"?', desc: "The bank, its attempt history and mastery progress will be permanently removed.", confirmLabel: "Delete bank", danger: true }, function () {
          store.deleteBank(name);
          ui.toast("Bank deleted.", "info");
          rerender();
          App.main.renderSidebar(App.router.currentName);
        });
      };
      setTimeout(function () { document.addEventListener("click", closeMenus, { once: true }); }, 0);
    });
  }
  View.wireBankGrid = wireBankGrid;
  View.bankCard = bankCard;
  View.statTile = statTile;
  View.wireGroupActions = wireGroupActions;

  function wire(wrap) {
    const u = App.u, store = App.store, ui = App.ui;
    const rerender = function () { View.render(document.getElementById("view")); };

    wireBankGrid(wrap, rerender);

    App.u.on(wrap, "click", "[data-act]", function (e, el) {
      const act = el.dataset.act, key = el.dataset.key;
      if (act === "import") App.router.go("#/import");
      else if (act === "builder") App.views.exam.openBuilder();
      else if (act === "ai") App.router.go("#/generator");
      else if (act === "samples") loadSamples();
      else if (act === "progress") App.router.go("#/progress");
      else if (act === "review-due") {
        const target = store.bankNames().filter(function (n) { return App.srs.dueCount(n); })[0];
        if (target) App.views.review.start(target, {});
        else App.ui.toast("Nothing is due right now.", "info");
      } else if (act === "review-any") App.router.go("#/review");
      else if (act === "drill-weak") {
        const weak = App.srs.weakest(null, 25);
        if (!weak.length) { ui.toast("No weak questions recorded yet.", "info"); return; }
        App.views.exam.launchMixed(weak.map(function (w) { return { bank: w.bank, id: w.q.id }; }),
          { passPct: 80, label: "Weak spots" });
      }
      else if (act === "resume-session") App.views.exam.resumeSession();
      else if (act === "discard-session") {
        ui.confirm({ title: "Discard in-progress exam?", desc: "Your saved progress for this session will be removed.", confirmLabel: "Discard", danger: true }, function () {
          store.clearSession();
          ui.toast("Session discarded.", "info");
          rerender();
        });
      }
      else if (act === "new-group") {
        ui.prompt({ title: "New exam group", desc: "Give this group a name \u2014 e.g. a certification track.", placeholder: "Group name", confirmLabel: "Create" }, function (v) {
          const name = store.addGroup(v);
          ui.toast("Group \u201C" + name + "\u201D created.", "ok");
          rerender();
        });
      }
      else if (act === "open-group") App.router.go("#/group/" + encodeURIComponent(key));
    });

    wireGroupActions(wrap, rerender);
  }

  /* Exam-group card actions: a single Edit button (name + icon together) and
     a Delete button — no dropdown, no separate rename/icon/links/members
     entries. Managing a group's links or member banks only happens on its
     detail page. `hooks.onRenamed(newName)` / `hooks.onDeleted()` let that
     detail page (whose route embeds the group's name) navigate instead of
     just re-rendering in place — the dashboard leaves them out since its own
     list re-render already reflects any rename/delete. */
  function wireGroupActions(wrap, rerender, hooks) {
    hooks = hooks || {};
    const store = App.store, ui = App.ui;

    App.u.on(wrap, "click", "[data-gedit]", function (e, el) {
      e.stopPropagation();
      ui.editGroup(el.dataset.gedit, { onSaved: rerender, onRenamed: hooks.onRenamed || rerender });
    });

    App.u.on(wrap, "click", "[data-gdelete]", function (e, el) {
      e.stopPropagation();
      const name = el.dataset.gdelete;
      const memberCount = store.groupMembers(name).length;
      ui.confirm({
        title: 'Delete "' + name + '"?',
        desc: memberCount ? "Its " + memberCount + " member bank" + (memberCount > 1 ? "s" : "") + " will move back to the ungrouped Exam banks list. This does not delete any banks." : "This group has no member banks.",
        confirmLabel: "Delete group", danger: true
      }, function () {
        store.deleteGroup(name);
        ui.toast("Group deleted.", "info");
        if (hooks.onDeleted) hooks.onDeleted(); else rerender();
      });
    });
  }

  /* load the two bundled .md files (only possible when served over http) */
  function loadSamples() {
    const files = [
      "Exams/ExamPro Feature Showcase.md",
      "Exams/Clarity Courses/The complete Expected Clarity Tech Pro Exam Questions.md",
      "Exams/Clarity Courses/Onlined Exam Dumps.MD"
    ];
    let done = 0, added = 0;
    files.forEach(function (f) {
      fetch(f)
        .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.text(); })
        .then(function (text) {
          const res = App.parser.parse(text);
          if (res.questions.length) {
            const name = App.store.addBank(f.replace(/\.[^.]+$/, ""), res.questions);
            added++;
          }
        })
        .catch(function () {})
        .finally(function () {
          done++;
          if (done === files.length) {
            if (added) App.ui.toast(added + " sample bank(s) loaded.", "ok");
            else App.ui.toast("Could not load sample files.", "err");
            View.render(document.getElementById("view"));
          }
        });
    });
  }
  View.loadSamples = loadSamples;

  App.views.dashboard = View;
})();