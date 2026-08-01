/* ExamPro — Study view: the Question & Answer Preview page */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Study — Q&A Preview", sub: "Questions and answers, side by side" };

  /* per-visit view state */
  let S = null;
  function freshState() {
    return { term: "", filter: "all", sort: "order", hideAnswers: false, revealed: {}, bankKey: null };
  }

  View.render = function (root, params) {
    const store = App.store;
    const key = decodeURIComponent(params.bankKey || "");
    const bank = store.getBank(key);

    if (!bank) {
      root.innerHTML = '<div class="view">' + App.ui.empty({
        icon: "book", title: "Bank not found",
        desc: "This question bank no longer exists. Pick another one from the dashboard.",
        actionsHtml: '<button class="btn btn-primary" onclick="App.router.go(\'#/dashboard\')">Back to dashboard</button>'
      }) + "</div>";
      return;
    }

    /* Study shows every correct answer next to its question — gate it like
       any other one-way action, every visit, so it's never opened by accident
       on someone else's screen or while trying to self-test. */
    root.innerHTML = "";
    let confirmed = false;
    App.ui.confirm({
      title: "This page shows the answers",
      desc: "Every question on “" + App.u.esc(bank.name) + "” is shown with its correct answer, side by side. If you want to test yourself first, use Review or Exam instead.",
      confirmLabel: "Show answers"
    }, function () { confirmed = true; renderBank(root, bank, key); });

    /* Cancelling (the button, clicking outside, or Escape) leaves an empty
       view behind — watch for the modal actually leaving the DOM, however
       that happened, and send them somewhere real if it wasn't a "yes". */
    const veil = document.getElementById("modal-veil");
    if (veil) {
      const obs = new MutationObserver(function () {
        if (document.body.contains(veil)) return;
        obs.disconnect();
        if (!confirmed && location.hash.indexOf("#/study/") === 0) App.router.go("#/dashboard");
      });
      obs.observe(document.body, { childList: true });
    }
  };

  View.destroy = function () {
    /* don't leave the confirm gate open if the user navigates away some
       other way (sidebar click, browser back) before answering it */
    if (document.getElementById("modal-veil")) App.ui.closeModal();
  };

  function renderBank(root, bank, key) {
    const u = App.u, store = App.store;
    if (!S || S.bankKey !== key) { S = freshState(); S.bankKey = key; }

    const st = store.bankStats(key);
    const masteryPct = st.count ? Math.round((st.mastered / st.count) * 100) : 0;

    root.innerHTML =
      '<div class="view">' +
      /* header */
      '<section class="card card-pad rise study-head">' +
      '<div class="ring-wrap study-ring">' + App.ui.ring(masteryPct, 74, 7) +
      '<div class="ring-label"><div class="ring-pct" style="font-size:17px">' + masteryPct + "%</div></div></div>" +
      '<div class="sh-txt" style="flex:1;min-width:220px">' +
      '<div class="sh-title">' + App.ui.editableBankBadge(bank.name, 22, "sh-badge") +
      "<h2>" + u.esc(bank.name) + "</h2></div>" +
      '<div class="sh-meta">' + st.count + " questions · " + st.mastered + " mastered · " +
      (st.attempts ? "best exam score " + st.best + "%" : "no exam attempts yet") + "</div>" +
      "</div>" +
      '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-ghost btn-sm" data-act="print">' + App.icon("print", 14) + "Print / PDF</button>" +
      '<button class="btn btn-soft btn-sm" data-act="to-review">' + App.icon("cards", 13) + "Review" +
      (st.due ? '<span class="btn-badge">' + st.due + "</span>" : "") + "</button>" +
      '<button class="btn btn-soft btn-sm" data-act="to-exam">' + App.icon("play", 13) + "Start exam</button>" +
      "</div></section>" +

      /* toolbar */
      '<section class="study-toolbar rise no-print" style="animation-delay:.06s;margin-top:16px">' +
      '<div class="search-wrap grow">' + '<span class="search-ico">' + App.icon("search", 15) + "</span>" +
      '<input class="input" id="study-search" placeholder="Search questions or answers…" value="' + u.esc(S.term) + '">' +
      "<kbd>/</kbd></div>" +
      '<div style="display:flex;gap:7px;flex-wrap:wrap" id="study-filters">' +
      fchip("all", "All", st.count) +
      fchip("single", "Single", st.types.single) +
      fchip("multiple", "Multi", st.types.multiple) +
      fchip("matching", "Matching", st.types.matching) +
      fchip("starred", "Mastered", st.mastered) +
      fchip("due", "Due", store.dueCount(key)) +
      "</div>" +
      '<button class="btn btn-ghost btn-sm" id="study-sort" title="Sort order">' + App.icon(S.sort === "order" ? "arrowR" : "bolt", 13) + (S.sort === "order" ? " Order" : " Due first") + "</button>" +
      '<label class="switch" title="Hide answers for self-quiz"><input type="checkbox" id="study-hide" ' + (S.hideAnswers ? "checked" : "") + '><span class="track"></span><span class="thumb"></span></label>' +
      '<span style="font-size:11.5px;font-weight:700;color:var(--muted);white-space:nowrap">' + App.icon("eyeOff", 13) + " Quiz me</span>" +
      '<button class="btn btn-ghost btn-sm" data-act="reveal-all">' + App.icon("study", 14) + "Reveal all</button>" +
      "</section>" +

      /* list */
      '<section id="study-list" style="margin-top:18px;display:flex;flex-direction:column;gap:14px"></section>' +
      '<section style="margin-top:26px" class="no-print">' +
      '<div class="card card-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
      App.ui.bankBadge(bank.name, 19) +
      '<div style="flex:1;min-width:200px"><div style="font-weight:800;font-size:13.5px">Ready to test yourself?</div>' +
      '<div style="font-size:12px;color:var(--muted);font-weight:500">Launch a timed, shuffled simulation of this bank.</div></div>' +
      '<button class="btn btn-danger btn-sm" data-act="reset-mastery">Reset mastery</button>' +
      '<button class="btn btn-primary" data-act="to-exam">' + App.icon("play", 15) + "Start exam</button>" +
      "</div></section>" +
      "</div>";

    wireToolbar(root.firstElementChild, bank);
    renderList(bank);
  }

  function fchip(val, label, n) {
    return '<button class="fchip' + (S.filter === val ? " on" : "") + '" data-filter="' + val + '">' + label + ' <span class="n">' + n + "</span></button>";
  }

  function updateMasteryHeader(bank) {
    const st = App.store.bankStats(bank.name);
    const pct = st.count ? Math.round((st.mastered / st.count) * 100) : 0;
    const wrap = document.querySelector(".study-head .ring-wrap");
    if (wrap) {
      wrap.innerHTML = App.ui.ring(pct, 74, 7) + '<div class="ring-label"><div class="ring-pct" style="font-size:17px">' + pct + "%</div></div>";
    }
    const meta = document.querySelector(".study-head .sh-meta");
    if (meta) meta.innerHTML = st.count + " questions · " + st.mastered + " mastered · " + (st.attempts ? "best exam score " + st.best + "%" : "no exam attempts yet");
  }

  function wireToolbar(wrap, bank) {
    const u = App.u;

    App.ui.wireBankBadges(wrap, function () {
      renderBank(document.getElementById("view"), bank, bank.name);
      App.main.renderSidebar("study");
    });

    const search = wrap.querySelector("#study-search");
    search.addEventListener("input", u.debounce(function () {
      S.term = search.value;
      renderList(bank);
    }, 160));

    wrap.querySelectorAll("#study-filters .fchip").forEach(function (chip) {
      chip.onclick = function () {
        S.filter = chip.dataset.filter;
        wrap.querySelectorAll("#study-filters .fchip").forEach(function (c) { c.classList.toggle("on", c === chip); });
        renderList(bank);
      };
    });

    wrap.querySelector("#study-hide").addEventListener("change", function (e) {
      S.hideAnswers = e.target.checked;
      S.revealed = {};
      renderList(bank);
    });

    const sortBtn = wrap.querySelector("#study-sort");
    if (sortBtn) sortBtn.onclick = function () {
      S.sort = S.sort === "order" ? "due" : "order";
      renderList(bank);
    };

    u.on(wrap, "click", "[data-act]", function (e, el) {
      const act = el.dataset.act;
      if (act === "print") window.print();
      else if (act === "to-exam") App.views.exam.openSetup(bank.name);
      else if (act === "to-review") App.views.review.start(bank.name, {});
      else if (act === "reveal-all") {
        bank.questions.forEach(function (q) { S.revealed[q.id] = true; });
        renderList(bank);
      } else if (act === "reset-mastery") {
        App.ui.confirm({ title: "Reset mastery progress?", desc: "All starred questions in this bank will be unmarked.", confirmLabel: "Reset", danger: true }, function () {
          App.store.resetMastered(bank.name);
          App.ui.toast("Mastery reset.", "info");
          renderBank(document.getElementById("view"), bank, bank.name);
        });
      }
    });

    /* delegated card interactions (survive list re-renders) */
    /* Revealing here is browsing, not recall — it deliberately does NOT touch the
       spaced-repetition schedule. Grading happens in Review mode, where the
       answer is hidden until you have committed to one. */
    u.on(wrap, "click", "[data-reveal]", function (e, el) {
      const id = el.dataset.reveal;
      S.revealed[id] = true;
      const veil = wrap.querySelector('.veil[data-veil="' + id + '"]');
      if (veil) veil.classList.add("revealed");
    });
    u.on(wrap, "click", "[data-star]", function (e, el) {
      const id = el.dataset.star;
      const on = App.store.toggleMastered(bank.name, id);
      el.classList.toggle("on", on);
      el.title = on ? "Mastered — click to unmark" : "Mark as mastered";
      if (on) App.ui.toast("Marked as mastered.", "ok");
      updateMasteryHeader(bank);
    });
  }

  /* ---------- question list ---------- */
  function renderList(bank) {
    const u = App.u, store = App.store;
    const list = document.getElementById("study-list");
    if (!list) return;
    const term = (S.term || "").trim().toLowerCase();

    const qs = bank.questions.filter(function (q) {
      if (S.filter !== "all") {
        if (S.filter === "starred") { if (!store.isMastered(bank.name, q.id)) return false; }
        else if (S.filter === "due") { if (!store.isDueForReview(bank.name, q.id)) return false; }
        else if (q.type !== S.filter) return false;
      }
      if (term) {
        const hay = (q.question + " " + q.options.join(" ") + " " + q.rightItems.join(" ") + " " + q.leftItems.join(" ")).toLowerCase();
        if (hay.indexOf(term) === -1) return false;
      }
      return true;
    });

    if (S.sort === "due") {
      qs.sort(function (a, b) {
        const da = store.isDueForReview(bank.name, a.id);
        const db = store.isDueForReview(bank.name, b.id);
        if (da && !db) return -1;
        if (!da && db) return 1;
        return a.id - b.id;
      });
    }

    if (!qs.length) {
      list.innerHTML = App.ui.empty({ icon: "search", title: "No questions match", desc: "Try a different search term or filter." });
      return;
    }

    list.innerHTML = qs.map(function (q, i) { return qCard(bank, q, i); }).join("");
  }

  function qCard(bank, q, i) {
    const u = App.u, store = App.store;
    const mastered = store.isMastered(bank.name, q.id);
    const hidden = S.hideAnswers && !S.revealed[q.id];
    const term = S.term;

    let body = App.ui.media(q);

    if (q.type === "matching") body += matchingHtml(q, hidden);
    else body += optionsHtml(q, hidden);

    return (
      '<article class="card qcard rise" style="animation-delay:' + Math.min(i * 0.04, 0.4) + 's">' +
      '<div class="qcard-head">' +
      '<span class="qcard-num">#' + (i + 1) + "</span>" +
      App.ui.typeChip(q.type) +
      scheduleChip(bank.name, q.id) +
      '<div class="spacer">' +
      '<button class="star-btn no-print' + (mastered ? " on" : "") + '" data-star="' + q.id + '" title="' + (mastered ? "Mastered — click to unmark" : "Mark as mastered") + '">' + App.icon("star", 16) + "</button>" +
      "</div></div>" +
      '<div class="qcard-body">' +
      '<div class="qcard-q">' + u.highlight(q.question, term) + "</div>" +
      body +
      "</div></article>"
    );
  }

  /* Where this question sits in the review schedule. */
  function scheduleChip(bankName, qid) {
    const srs = App.srs;
    const card = srs.card(bankName, qid);
    if (!card.reps) return '<span class="chip chip-mut">New</span>';
    if (srs.isDue(bankName, qid)) return '<span class="chip chip-warn">' + App.icon("cards", 10, 2.2) + "Due now</span>";
    const days = Math.max(1, Math.ceil((card.due - Date.now()) / 86400000));
    return '<span class="chip chip-mut" title="Next review in ' + srs.fmtInterval(days) + '">' +
      App.icon("clock", 10, 2.2) + "in " + srs.fmtInterval(days) + "</span>";
  }

  /* options with correct answers highlighted (or veiled) */
  function optionsHtml(q, hidden) {
    const u = App.u, term = S.term;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let rows = q.options.map(function (opt, oi) {
      const isCorrect = q.correctIndices.indexOf(oi) !== -1;
      const cls = isCorrect ? " opt-row is-correct" : "opt-row";
      const tag = isCorrect ? '<span class="opt-tag t-ok">Answer</span>' : "";
      const letter = isCorrect
        ? '<span class="opt-letter">' + App.icon("check", 12, 3) + "</span>"
        : '<span class="opt-letter">' + letters[oi % 26] + "</span>";
      return '<div class="' + cls + '">' + letter + "<span>" + u.highlight(opt, term) + "</span>" + tag + "</div>";
    }).join("");

    if (!hidden) return '<div class="opt-list">' + rows + "</div>";
    return (
      '<div class="veil" data-veil="' + q.id + '">' +
      '<div class="veil-target opt-list">' + rows + "</div>" +
      '<button class="veil-btn" data-reveal="' + q.id + '"><span>' + App.icon("study", 13) + "Reveal answer</span></button>" +
      "</div>"
    );
  }

  /* matching pairs: definition -> correct item (right side veiled in quiz mode) */
  function matchingHtml(q, hidden) {
    const u = App.u, term = S.term;
    let pairs = q.leftItems.map(function (left, li) {
      const right = q.correctAnswers[li] || "—";
      return (
        '<div class="match-pair">' +
        '<div class="mp-l">' + u.highlight(left, term) + "</div>" +
        '<div class="mp-arrow">' + App.icon("arrowR", 15, 2.2) + "</div>" +
        '<div class="mp-r">' + u.highlight(right, term) + "</div>" +
        "</div>"
      );
    }).join("");

    if (!hidden) return '<div class="match-pairs">' + pairs + "</div>";
    return (
      '<div class="veil" data-veil="' + q.id + '">' +
      '<div class="veil-target match-pairs">' + pairs + "</div>" +
      '<button class="veil-btn" data-reveal="' + q.id + '"><span>' + App.icon("study", 13) + "Reveal matches</span></button>" +
      "</div>"
    );
  }

  App.views.study = View;
})();
