/* ExamPro — Review: active-recall flashcards driven by the SM-2 scheduler.
 *
 * Flow per card:  prompt → (space) reveal → grade 1-4 → next.
 * "Again" re-queues the card a few positions later so it is re-tested in the
 * same sitting; every other grade schedules it forward and drops it.
 */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Review", sub: "Active recall, scheduled for you" };

  let R = null;          // live review session
  let keyHandler = null;
  let tickId = null;

  const AGAIN_GAP = 4;   // how many cards later an "Again" card returns

  /* ---------------- session lifecycle ---------------- */

  function buildQueue(bankKey, size) {
    const due = App.srs.dueIds(bankKey);
    return due.slice(0, size);
  }

  View.start = function (bankKey, opts) {
    opts = opts || {};
    const bank = App.store.getBank(bankKey);
    if (!bank) { App.ui.toast("Bank not found.", "err"); return; }

    const size = opts.size || App.store.state.settings.reviewSize || 20;
    const ids = opts.ids || buildQueue(bankKey, size);
    if (!ids.length) {
      App.ui.toast("Nothing is due in this bank — you're all caught up.", "ok");
      return;
    }
    const byId = {};
    bank.questions.forEach(function (q) { byId[q.id] = q; });

    R = {
      bankKey: bankKey,
      queue: ids.filter(function (id) { return byId[id]; }),
      byId: byId,
      pos: 0,
      revealed: false,
      startedAt: Date.now(),
      cardShownAt: Date.now(),
      done: 0,
      planned: ids.length,
      grades: [0, 0, 0, 0],
      seenIds: {}
    };
    App.router.go("#/review/" + encodeURIComponent(bankKey));
  };

  View.render = function (root, params) {
    const key = decodeURIComponent((params && params.bankKey) || "");

    /* A finished session should not replay its summary when you come back to
       Review later — only an in-progress queue is worth resuming. */
    if (R && R.pos >= R.queue.length && !key) R = null;

    /* arriving cold (deep link / refresh) — offer to build a queue */
    if (!R || (key && R.bankKey !== key)) {
      const bank = key && App.store.getBank(key);
      if (!bank) { renderPicker(root); return; }
      const ids = buildQueue(key, App.store.state.settings.reviewSize || 20);
      if (!ids.length) { renderCaughtUp(root, key); return; }
      View.start(key, { ids: ids });   /* start() re-enters render through the router */
      if (!R) renderPicker(root);
      return;
    }

    root.innerHTML = '<div class="view review-view"><div id="review-stage"></div></div>';
    /* one delegated handler for the life of this stage element — renderCard()
       replaces its innerHTML many times and must not re-bind each pass */
    wireStage(document.getElementById("review-stage"));
    renderCard();
    bindKeys();
    startTick();
  };

  View.destroy = function () {
    unbindKeys();
    stopTick();
  };

  /* ---------------- entry states ---------------- */

  function renderPicker(root) {
    const store = App.store;
    const names = store.bankNames();
    if (!names.length) {
      root.innerHTML = '<div class="view">' + App.ui.empty({
        icon: "book", title: "No banks to review",
        desc: "Import a question bank first — the scheduler builds a queue as soon as there is something to learn.",
        actionsHtml: '<button class="btn btn-primary" onclick="App.router.go(\'#/import\')">Open importer</button>'
      }) + "</div>";
      return;
    }
    const rows = names.map(function (n) {
      const b = App.srs.queueBreakdown(n);
      const dueN = b.fresh + b.learning + b.review;
      return (
        '<button class="review-pick' + (dueN ? "" : " done") + '" data-bank="' + App.u.esc(n) + '">' +
        App.ui.bankBadge(n, 18, "rp-ico") +
        '<span class="rp-body"><span class="rp-name">' + App.u.esc(n) + "</span>" +
        '<span class="rp-meta">' + b.fresh + " new · " + b.learning + " learning · " + b.review + " to review</span></span>" +
        '<span class="rp-count">' + (dueN || "✓") + "</span></button>"
      );
    }).join("");

    root.innerHTML =
      '<div class="view" style="max-width:760px;margin:0 auto">' +
      '<section class="card card-pad rise">' +
      '<h2 style="font-size:17px;font-weight:800;letter-spacing:-0.02em">' + App.icon("cards", 17) + " Pick a deck to review</h2>" +
      "<p style='font-size:12.5px;color:var(--muted);font-weight:500;margin:5px 0 16px'>Each deck schedules itself. Cards you find hard come back sooner; cards you know get pushed weeks out.</p>" +
      '<div class="review-picks">' + rows + "</div>" +
      "</section></div>";

    App.u.on(root.firstElementChild, "click", "[data-bank]", function (e, el) {
      View.start(el.dataset.bank, {});
    });
  }

  function renderCaughtUp(root, key) {
    const fc = App.srs.forecast(key, 14);
    let nextIdx = -1;
    for (let i = 0; i < fc.length; i++) if (fc[i].count) { nextIdx = i; break; }
    const when = nextIdx < 0 ? "in more than two weeks"
      : nextIdx === 0 ? "later today"
      : nextIdx === 1 ? "tomorrow"
      : "in " + nextIdx + " days";

    root.innerHTML =
      '<div class="view" style="max-width:640px;margin:0 auto">' +
      '<section class="card card-pad rise caught-up">' +
      '<div class="cu-ring">' + App.ui.ring(App.srs.retention(key), 96, 8, "var(--ok)") +
      '<div class="ring-label"><div class="ring-pct" style="font-size:20px">' + App.srs.retention(key) + "%</div>" +
      '<div class="ring-sub">retained</div></div></div>' +
      "<h2 style='font-size:19px;font-weight:800;letter-spacing:-0.03em;margin-top:16px'>Queue clear for " + App.u.esc(key) + "</h2>" +
      "<p style='font-size:13px;color:var(--muted);font-weight:500;margin-top:6px'>Nothing is due right now. The next cards surface " + when + ".</p>" +
      '<div style="display:flex;gap:9px;flex-wrap:wrap;justify-content:center;margin-top:20px">' +
      '<button class="btn btn-soft" data-act="ahead">' + App.icon("bolt", 15) + "Study ahead anyway</button>" +
      '<button class="btn btn-ghost" data-act="study">' + App.icon("study", 15) + "Q&A preview</button>" +
      '<button class="btn btn-ghost" data-act="dash">' + App.icon("home", 15) + "Dashboard</button>" +
      "</div></section></div>";

    App.u.on(root.firstElementChild, "click", "[data-act]", function (e, el) {
      const a = el.dataset.act;
      if (a === "dash") App.router.go("#/dashboard");
      else if (a === "study") App.router.go("#/study/" + encodeURIComponent(key));
      else if (a === "ahead") {
        const bank = App.store.getBank(key);
        const ids = bank.questions.slice()
          .sort(function (x, y) { return App.srs.card(key, x.id).due - App.srs.card(key, y.id).due; })
          .slice(0, 20).map(function (q) { return q.id; });
        View.start(key, { ids: ids });
      }
    });
  }

  /* ---------------- the card ---------------- */

  function currentId() { return R.queue[R.pos]; }

  function renderCard() {
    const stage = document.getElementById("review-stage");
    if (!stage || !R) return;

    if (R.pos >= R.queue.length) { renderSummary(stage); return; }

    const u = App.u;
    const q = R.byId[currentId()];
    const card = App.srs.card(R.bankKey, q.id);
    const stat = App.srs.stat(R.bankKey, q.id);
    const stage_lbl = !card.reps ? "New" : card.interval < 7 ? "Learning" : "Review";
    const stageCls = !card.reps ? "s-new" : card.interval < 7 ? "s-learn" : "s-rev";
    const pct = Math.round((R.done / Math.max(1, R.planned)) * 100);
    const accLbl = stat.seen ? Math.round((stat.correct / stat.seen) * 100) + "% lifetime" : "first look";

    stage.innerHTML =
      /* header */
      '<div class="review-bar">' +
      '<button class="icon-btn" data-act="quit" title="End review" aria-label="End review">' + App.icon("x", 15) + "</button>" +
      '<div class="rb-meta"><div class="rb-bank">' + u.esc(R.bankKey) + "</div>" +
      '<div class="rb-sub">' + R.done + " of " + R.planned + " · " + u.fmtDuration(Math.round((Date.now() - R.startedAt) / 1000)) + "</div></div>" +
      '<div class="rb-track"><i style="width:' + pct + '%"></i></div>' +
      '<span class="rev-stage ' + stageCls + '">' + stage_lbl + "</span>" +
      "</div>" +

      /* card */
      '<div class="flashcard' + (R.revealed ? " flipped" : "") + '" id="flashcard">' +
      '<div class="fc-top">' +
      App.ui.typeChip(q.type) +
      '<span class="fc-hint">' + accLbl + (card.reps ? " · " + card.reps + " rep" + (card.reps > 1 ? "s" : "") : "") +
      (card.lapses ? " · " + card.lapses + " lapse" + (card.lapses > 1 ? "s" : "") : "") + "</span>" +
      '<button class="star-btn' + (App.store.isMastered(R.bankKey, q.id) ? " on" : "") + '" data-act="star" title="Mark as mastered">' + App.icon("star", 16) + "</button>" +
      "</div>" +
      '<div class="fc-q">' + u.esc(q.question) + "</div>" +
      App.ui.media(q) +
      (R.revealed ? answerHtml(q) : promptHtml(q)) +
      "</div>" +

      /* controls */
      (R.revealed ? gradeBarHtml(q) :
        '<div class="review-foot">' +
        '<button class="btn btn-primary btn-lg" data-act="reveal">' + App.icon("study", 17) + "Show answer</button>" +
        '<span class="kbd-hint">Space or Enter to flip</span>' +
        "</div>");
  }

  /* Un-revealed side: options listed without any correctness cues. */
  function promptHtml(q) {
    const u = App.u;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (q.type === "matching") {
      return '<div class="fc-prompt"><div class="fc-prompt-lbl">Match these</div><div class="match-pairs">' +
        q.leftItems.map(function (l) {
          return '<div class="match-pair"><div class="mp-l">' + u.esc(l) + '</div><div class="mp-arrow">' + App.icon("arrowR", 15, 2.2) +
            '</div><div class="mp-r fc-blank">?</div></div>';
        }).join("") + "</div></div>";
    }
    return '<div class="fc-prompt"><div class="fc-prompt-lbl">' +
      (q.type === "multiple" ? "Which of these apply?" : "Which one?") + "</div>" +
      '<div class="opt-list">' + q.options.map(function (o, i) {
        return '<div class="opt-row"><span class="opt-letter">' + letters[i % 26] + "</span><span>" + u.esc(o) + "</span></div>";
      }).join("") + "</div></div>";
  }

  function answerHtml(q) {
    const u = App.u;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (q.type === "matching") {
      return '<div class="fc-answer"><div class="fc-prompt-lbl">Answer</div><div class="match-pairs">' +
        q.leftItems.map(function (l, li) {
          return '<div class="match-pair is-ok"><div class="mp-l">' + u.esc(l) + '</div><div class="mp-arrow">' + App.icon("arrowR", 15, 2.2) +
            '</div><div class="mp-r">' + u.esc(q.correctAnswers[li] || "—") + "</div></div>";
        }).join("") + "</div></div>";
    }
    return '<div class="fc-answer"><div class="fc-prompt-lbl">Answer</div><div class="opt-list">' +
      q.options.map(function (o, i) {
        const ok = q.correctIndices.indexOf(i) !== -1;
        return '<div class="opt-row' + (ok ? " is-correct" : " is-dim") + '">' +
          '<span class="opt-letter">' + (ok ? App.icon("check", 12, 3) : letters[i % 26]) + "</span><span>" + u.esc(o) + "</span>" +
          (ok ? '<span class="opt-tag t-ok">Correct answer</span>' : "") + "</div>";
      }).join("") + "</div></div>";
  }

  function gradeBarHtml(q) {
    return '<div class="grade-bar">' + App.srs.GRADES.map(function (g, i) {
      const iv = App.srs.preview(R.bankKey, q.id, i);
      return '<button class="grade-btn g-' + g.key + '" data-grade="' + i + '" title="' + g.hint + '">' +
        '<span class="gb-key">' + (i + 1) + "</span>" +
        '<span class="gb-lbl">' + g.label + "</span>" +
        '<span class="gb-iv">' + App.srs.fmtInterval(iv) + "</span></button>";
    }).join("") + "</div>";
  }

  function wireStage(stage) {
    App.u.on(stage, "click", "[data-grade]", function (e, el) {
      applyGrade(parseInt(el.dataset.grade, 10));
    });
    App.u.on(stage, "click", "[data-act]", function (e, el) {
      const a = el.dataset.act;
      if (a === "reveal") reveal();
      else if (a === "quit") quit();
      else if (a === "star") {
        const on = App.store.toggleMastered(R.bankKey, currentId());
        el.classList.toggle("on", on);
      }
      /* summary actions */
      else if (a === "more") { const k = R.bankKey; R = null; View.start(k, {}); }
      else if (a === "exam") { const k = R.bankKey; R = null; App.views.exam.openSetup(k); }
      else if (a === "progress") { R = null; App.router.go("#/progress"); }
      else if (a === "dash") { R = null; App.router.go("#/dashboard"); }
    });
  }

  function reveal() {
    if (!R || R.revealed) return;
    R.revealed = true;
    renderCard();
  }

  function applyGrade(g) {
    if (!R || !R.revealed) return;
    const id = currentId();
    const ms = Date.now() - R.cardShownAt;

    App.srs.grade(R.bankKey, id, g);
    App.srs.record(R.bankKey, id, g >= 2, ms);
    App.srs.logActivity({ reviews: 1, answered: 1, correct: g >= 2 ? 1 : 0, seconds: Math.round(ms / 1000) });
    R.grades[g]++;
    R.seenIds[id] = true;

    if (g === 0) {
      /* requeue a few cards down so it is re-tested this sitting */
      R.queue.splice(Math.min(R.queue.length, R.pos + 1 + AGAIN_GAP), 0, id);
    } else {
      R.done++;
    }

    R.pos++;
    R.revealed = false;
    R.cardShownAt = Date.now();
    renderCard();
  }

  function quit() {
    App.ui.confirm({
      title: "End this review?",
      desc: "Cards you already graded are saved — the rest stay in the queue for next time.",
      confirmLabel: "End review"
    }, function () {
      R.pos = R.queue.length;   /* jump to the summary */
      renderCard();
    });
  }

  /* ---------------- summary ---------------- */

  function renderSummary(stage) {
    const u = App.u;
    const secs = Math.round((Date.now() - R.startedAt) / 1000);
    const total = R.grades.reduce(function (a, b) { return a + b; }, 0);
    const kept = R.grades[1] + R.grades[2] + R.grades[3];
    const recall = total ? Math.round((kept / total) * 100) : 0;
    const perCard = total ? Math.round(secs / total) : 0;
    const remaining = App.srs.dueCount(R.bankKey);

    stopTick();
    if (recall >= 90 && total >= 5) setTimeout(App.ui.confetti, 350);

    const bars = App.srs.GRADES.map(function (g, i) {
      const n = R.grades[i];
      const pct = total ? Math.round((n / total) * 100) : 0;
      return '<div class="acc-bar-row"><span class="ab-l">' + g.label + "</span>" +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + "%;background:" + g.color + '"></div></div>' +
        '<span class="ab-n">' + n + "</span></div>";
    }).join("");

    stage.innerHTML =
      '<section class="card card-pad rise review-summary">' +
      '<div class="ring-wrap">' + App.ui.ring(recall, 132, 9, recall >= 80 ? "var(--ok)" : "var(--acc)") +
      '<div class="ring-label"><div class="ring-pct" id="rev-sum-pct">0%</div><div class="ring-sub">recalled</div></div></div>' +
      '<div style="flex:1;min-width:260px">' +
      "<h2 style='font-size:21px;font-weight:800;letter-spacing:-0.03em'>Review complete</h2>" +
      "<p style='font-size:12.5px;color:var(--muted);font-weight:500;margin-top:5px'>" +
      u.esc(R.bankKey) + " · " + total + " card" + (total === 1 ? "" : "s") + " graded in " + u.fmtDuration(secs) + "</p>" +
      '<div class="mini-stats" style="grid-template-columns:repeat(3,1fr);margin-top:16px;max-width:430px">' +
      '<div class="mini-stat"><div class="ms-n" style="color:var(--acc)">' + R.done + '</div><div class="ms-l">Cards cleared</div></div>' +
      '<div class="mini-stat"><div class="ms-n" style="color:var(--warn)">' + perCard + 's</div><div class="ms-l">Per card</div></div>' +
      '<div class="mini-stat"><div class="ms-n" style="color:var(--muted)">' + remaining + '</div><div class="ms-l">Still due</div></div>' +
      "</div>" +
      '<div class="acc-bars" style="margin-top:16px;max-width:430px">' + bars + "</div>" +
      '<div style="display:flex;gap:9px;margin-top:20px;flex-wrap:wrap">' +
      (remaining ? '<button class="btn btn-primary" data-act="more">' + App.icon("cards", 15) + "Review " + Math.min(remaining, 20) + " more</button>" : "") +
      '<button class="btn btn-soft" data-act="exam">' + App.icon("play", 14) + "Take the exam</button>" +
      '<button class="btn btn-ghost" data-act="progress">' + App.icon("chart", 15) + "See progress</button>" +
      '<button class="btn btn-ghost" data-act="dash">' + App.icon("home", 15) + "Dashboard</button>" +
      "</div></div></section>";

    const pctEl = document.getElementById("rev-sum-pct");
    if (pctEl) u.countUp(pctEl, recall, { suffix: "%", duration: 1000 });
  }

  /* ---------------- timer + keys ---------------- */

  function startTick() {
    stopTick();
    tickId = setInterval(function () {
      if (!R || R.pos >= R.queue.length) return;
      const el = document.querySelector(".review-bar .rb-sub");
      if (el) el.textContent = R.done + " of " + R.planned + " · " + App.u.fmtDuration(Math.round((Date.now() - R.startedAt) / 1000));
    }, 1000);
  }
  function stopTick() { if (tickId) { clearInterval(tickId); tickId = null; } }

  function bindKeys() {
    unbindKeys();
    keyHandler = function (e) {
      if (!R || location.hash.indexOf("#/review") !== 0) return;
      if (e.target.matches("input, textarea, select")) return;
      if (R.pos >= R.queue.length) return;
      if (!R.revealed) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); reveal(); }
        return;
      }
      if (/^[1-4]$/.test(e.key)) { e.preventDefault(); applyGrade(parseInt(e.key, 10) - 1); }
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); applyGrade(2); }
    };
    document.addEventListener("keydown", keyHandler);
  }
  function unbindKeys() {
    if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
  }

  App.views.review = View;
})();
