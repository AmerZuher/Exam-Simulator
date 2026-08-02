/* ExamPro — Exam view: setup, timed session, keyboard shortcuts, persistence */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Exam session", sub: "Answer carefully — good luck" };

  let session = null;       // live session (mirrored to store)
  let timerId = null;
  let paused = false;
  let expired = false;      // time limit hit — auto-submit in flight
  let keyHandler = null;
  let qStart = 0;           // when the current question came on screen

  /* ---- per-question stopwatch ---- */
  function markQuestionStart() { qStart = Date.now(); }
  function bankQuestionTime() {
    if (!session || !qStart || paused) { qStart = Date.now(); return; }
    const ms = Date.now() - qStart;
    if (ms > 0 && ms < 30 * 60 * 1000) {
      session.times[session.index] = (session.times[session.index] || 0) + ms;
    }
    qStart = Date.now();
  }

  const saveSession = function () {
    if (!session) return;
    session.paused = paused;
    App.store.state.session = session;
    App.store.saveSession();
  };
  const throttledSave = function () {
    if (!View._th) View._th = App.u.throttle(saveSession, 800);
    View._th();
  };

  /* ---------------- question pools ---------------- */
  /* Each pool returns the ids to draw from, or null for "the whole bank". */
  const POOLS = {
    all: { label: "Everything in the bank", ids: function () { return null; } },
    weak: {
      label: "Weak spots — questions you keep missing",
      ids: function (k) { return App.srs.weakIds(k, 60); }
    },
    due: {
      label: "Due for review — what the scheduler picked",
      ids: function (k) { return App.srs.dueIds(k); }
    },
    fresh: {
      label: "Never seen — questions you have not answered yet",
      ids: function (k) {
        const b = App.store.getBank(k);
        return b.questions.filter(function (q) { return !App.srs.stat(k, q.id).seen; }).map(function (q) { return q.id; });
      }
    },
    starred: {
      label: "Mastered only — prove you still know them",
      ids: function (k) {
        const b = App.store.getBank(k);
        return b.questions.filter(function (q) { return App.store.isMastered(k, q.id); }).map(function (q) { return q.id; });
      }
    }
  };

  function poolCount(bankKey, pool) {
    const ids = POOLS[pool].ids(bankKey);
    return ids === null ? App.store.getBank(bankKey).questions.length : ids.length;
  }

  /* ---------------- setup modal ---------------- */
  View.openSetup = function (bankKey) {
    const store = App.store, u = App.u;
    const bank = store.getBank(bankKey);
    if (!bank) { App.ui.toast("Bank not found.", "err"); return; }
    const total = bank.questions.length;

    const poolOpts = Object.keys(POOLS).map(function (k) {
      const n = poolCount(bankKey, k);
      return '<option value="' + k + '"' + (k === "all" ? " selected" : "") + (n ? "" : " disabled") + ">" +
        POOLS[k].label + " (" + n + ")</option>";
    }).join("");

    const brackets = [5, 10, 20, 50, 100, 150].filter(function (n) { return n < total; });
    const limitOpts = '<option value="all" selected>No cap — use the whole pool</option>' +
      brackets.map(function (n) { return '<option value="' + n + '">Cap at ' + n + " questions</option>"; }).join("");

    const veil = App.ui.customModal(
      '<div class="modal-head"><div>' +
      '<div class="modal-title">Configure exam session</div>' +
      '<div class="modal-sub">' + u.esc(bankKey) + " · " + total + " questions available</div>" +
      "</div>" +
      '<button class="icon-btn" data-x>' + App.icon("x", 15) + "</button></div>" +

      '<div style="display:flex;flex-direction:column;gap:14px">' +
      "<div><label class='field-lbl'>Question pool</label><select class='select' id='setup-pool'>" + poolOpts + "</select>" +
      "<div class='field-hint' id='setup-pool-hint'></div></div>" +
      "<div><label class='field-lbl'>Session length</label><select class='select' id='setup-limit'>" + limitOpts + "</select></div>" +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      "<div><label class='field-lbl'>Time limit</label><select class='select' id='setup-time'>" +
      '<option value="0" selected>No limit — count up</option>' +
      '<option value="600">10 minutes</option><option value="1200">20 minutes</option>' +
      '<option value="1800">30 minutes</option><option value="2700">45 minutes</option>' +
      '<option value="3600">60 minutes</option><option value="5400">90 minutes</option>' +
      '<option value="pace">Exam pace — 90s per question</option></select></div>' +
      "<div><label class='field-lbl'>Pass threshold</label><select class='select' id='setup-pass'>" +
      '<option value="50">50% — casual</option><option value="70" selected>70% — standard</option><option value="80">80% — strict</option><option value="90">90% — expert</option></select></div>' +
      "</div>" +
      '<div class="switch-row"><div><div class="sr-txt">Shuffle question order</div><div class="sr-sub">Randomize the sequence of questions.</div></div>' +
      '<label class="switch"><input type="checkbox" id="setup-shufq" checked><span class="track"></span><span class="thumb"></span></label></div>' +
      '<div class="switch-row"><div><div class="sr-txt">Shuffle answer options</div><div class="sr-sub">Randomize option order (correct answers are re-mapped).</div></div>' +
      '<label class="switch"><input type="checkbox" id="setup-shufo"><span class="track"></span><span class="thumb"></span></label></div>' +
      "</div>" +

      '<div class="modal-foot">' +
      '<button class="btn btn-ghost" data-x>Cancel</button>' +
      '<button class="btn btn-primary" id="setup-go">' + App.icon("play", 15) + "Start exam</button>" +
      "</div>"
    );

    const poolSel = veil.querySelector("#setup-pool");
    const hint = veil.querySelector("#setup-pool-hint");
    function refreshHint() {
      const n = poolCount(bankKey, poolSel.value);
      hint.textContent = n
        ? n + " question" + (n === 1 ? "" : "s") + " in this pool."
        : "This pool is empty right now.";
    }
    poolSel.onchange = refreshHint;
    refreshHint();

    veil.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = App.ui.closeModal; });
    veil.querySelector("#setup-go").onclick = function () {
      const pool = poolSel.value;
      if (!poolCount(bankKey, pool)) { App.ui.toast("That pool has no questions.", "err"); return; }
      App.ui.closeModal();
      launch(bankKey, {
        pool: pool,
        limit: veil.querySelector("#setup-limit").value,
        timeLimit: veil.querySelector("#setup-time").value,
        passPct: parseInt(veil.querySelector("#setup-pass").value, 10),
        shuffleQuestions: veil.querySelector("#setup-shufq").checked,
        shuffleOptions: veil.querySelector("#setup-shufo").checked
      });
    };
  };

  function launch(bankKey, cfg) {
    const bank = App.store.getBank(bankKey);
    if (!bank) return;

    const poolIds = POOLS[cfg.pool || "all"].ids(bankKey);
    let source = bank.questions;
    if (poolIds !== null) {
      const want = {};
      poolIds.forEach(function (id) { want[id] = true; });
      const order = {};
      poolIds.forEach(function (id, i) { order[id] = i; });
      source = bank.questions.filter(function (q) { return want[q.id]; })
        .sort(function (a, b) { return order[a.id] - order[b.id]; });
    }

    let qs = source.map(function (q) { return cloneQuestion(q); });
    if (cfg.shuffleOptions) qs = qs.map(shuffleQuestionOptions);
    if (cfg.shuffleQuestions) qs = App.u.shuffle(qs);
    if (cfg.limit && cfg.limit !== "all") qs = qs.slice(0, parseInt(cfg.limit, 10));

    if (!qs.length) { App.ui.toast("This bank has no questions.", "err"); return; }

    startSession({
      bankKey: bankKey,
      label: cfg.label || (cfg.pool && cfg.pool !== "all" ? POOLS[cfg.pool].label.split(" — ")[0] : ""),
      questions: qs,
      passPct: cfg.passPct || 70,
      timeLimit: resolveTimeLimit(cfg.timeLimit, qs.length)
    });
  }

  function resolveTimeLimit(v, count) {
    if (v === "pace") return count * 90;
    const n = parseInt(v, 10);
    return isNaN(n) || n <= 0 ? 0 : n;
  }

  function startSession(spec) {
    session = {
      bankKey: spec.bankKey,
      label: spec.label || "",
      questions: spec.questions,
      origin: spec.origin || null,     // [{bank, id}] for mixed sessions
      index: 0,
      responses: {},
      flags: {},
      times: {},                       // index -> ms spent
      seconds: 0,
      timeLimit: spec.timeLimit || 0,  // seconds; 0 = count up, no cap
      passPct: spec.passPct || 70,
      startedAt: Date.now()
    };
    paused = false;
    expired = false;
    saveSession();
    App.router.go("#/exam");
  }

  /* Build a session from explicit question ids in one bank (weak-spot drills). */
  View.launchFromIds = function (bankKey, ids, cfg) {
    cfg = cfg || {};
    const bank = App.store.getBank(bankKey);
    if (!bank) { App.ui.toast("Bank not found.", "err"); return; }
    const want = {};
    ids.forEach(function (id) { want[id] = true; });
    let qs = bank.questions.filter(function (q) { return want[q.id]; }).map(cloneQuestion);
    if (!qs.length) { App.ui.toast("Those questions are no longer in the bank.", "err"); return; }
    if (cfg.shuffleQuestions !== false) qs = App.u.shuffle(qs);
    startSession({
      bankKey: bankKey,
      label: cfg.label || "Custom drill",
      questions: qs,
      passPct: cfg.passPct || 70,
      timeLimit: resolveTimeLimit(cfg.timeLimit, qs.length)
    });
  };

  /* Build a session from {bank, id} pairs spanning several banks. */
  View.launchMixed = function (pairs, cfg) {
    cfg = cfg || {};
    const qs = [], origin = [];
    pairs.forEach(function (p) {
      const bank = App.store.getBank(p.bank);
      if (!bank) return;
      const q = bank.questions.filter(function (x) { return x.id === p.id; })[0];
      if (!q) return;
      qs.push(cloneQuestion(q));
      origin.push({ bank: p.bank, id: p.id });
    });
    if (!qs.length) { App.ui.toast("Nothing to drill.", "err"); return; }
    startSession({
      bankKey: cfg.label || "Mixed drill",
      label: cfg.label || "Mixed drill",
      questions: qs,
      origin: origin,
      passPct: cfg.passPct || 70,
      timeLimit: resolveTimeLimit(cfg.timeLimit, qs.length)
    });
  };

  function cloneQuestion(q) {
    return {
      id: q.id, question: q.question, type: q.type,
      options: q.options.slice(), correctIndices: q.correctIndices.slice(),
      images: (q.images || []).slice(), audios: (q.audios || []).slice(), videos: (q.videos || []).slice(),
      leftItems: (q.leftItems || []).slice(), rightItems: (q.rightItems || []).slice(),
      correctAnswers: Object.assign({}, q.correctAnswers)
    };
  }

  function shuffleQuestionOptions(q) {
    if (q.type === "matching") {
      // Shuffle which definition sits in which row (not just the hidden
      // dropdown order) so shuffling is actually visible, then re-key
      // correctAnswers to the new row positions.
      const order = App.u.shuffle(q.leftItems.map(function (_, i) { return i; }));
      const newLeft = order.map(function (li) { return q.leftItems[li]; });
      const newCorrect = {};
      order.forEach(function (li, newIdx) { newCorrect[newIdx] = q.correctAnswers[li]; });
      q.leftItems = newLeft;
      q.correctAnswers = newCorrect;
      q.rightItems = App.u.shuffle(q.rightItems);
      return q;
    }
    const order = App.u.shuffle(q.options.map(function (_, i) { return i; }));
    const newOpts = order.map(function (oi) { return q.options[oi]; });
    const newCorrect = [];
    order.forEach(function (oi, newIdx) { if (q.correctIndices.indexOf(oi) !== -1) newCorrect.push(newIdx); });
    q.options = newOpts;
    q.correctIndices = newCorrect;
    return q;
  }

  /* ---------------- resume ---------------- */
  View.resumeSession = function () {
    const s = App.store.state.session;
    /* mixed drills have no bank of their own — they carry `origin` instead */
    if (!s || (!s.origin && !App.store.getBank(s.bankKey))) {
      App.store.clearSession();
      App.ui.toast("Saved session is no longer valid.", "err");
      return;
    }
    session = normalizeSession(s);
    paused = true; // resume into paused state so the user can settle
    expired = false;
    App.router.go("#/exam");
    App.ui.toast("Session restored — press play when ready.", "info");
  };

  /* Sessions saved by earlier versions lack the newer fields. */
  function normalizeSession(s) {
    if (!s.times) s.times = {};
    if (s.timeLimit == null) s.timeLimit = 0;
    if (s.label == null) s.label = "";
    return s;
  }

  /* ---------------- render ---------------- */
  View.render = function (root) {
    if (!session) {
      const saved = App.store.state.session;
      if (saved && (saved.origin || App.store.getBank(saved.bankKey))) { session = normalizeSession(saved); paused = true; }
      else { App.router.go("#/dashboard"); return; }
    }
    markQuestionStart();

    root.innerHTML =
      '<div class="view exam-layout">' +
      '<section class="card card-pad exam-main rise" id="exam-main"></section>' +
      '<aside class="card card-pad rise" style="animation-delay:.07s" id="exam-side"></aside>' +
      "</div>";

    renderSide();
    renderQuestion();
    startTimer();
    bindKeys();

    if (paused) showPauseOverlay();
    App.views.exam.updateTopbar();
  };

  View.destroy = function () {
    if (session) bankQuestionTime();
    stopTimer();
    unbindKeys();
    hidePauseOverlay();
    App.views.exam.updateTopbar(true);
    if (session) { saveSession(); }
  };

  /* ---------------- timer ---------------- */
  function remaining() {
    if (!session || !session.timeLimit) return null;
    return Math.max(0, session.timeLimit - session.seconds);
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(function () {
      if (paused || !session || expired) return;
      session.seconds++;
      updateClock();
      const left = remaining();
      if (left !== null) {
        if (left === 300 || left === 60) {
          App.ui.toast(left === 60 ? "One minute left." : "Five minutes left.", "err");
        }
        if (left <= 0) { timeUp(); return; }
      }
      if (session.seconds % 5 === 0) throttledSave();
    }, 1000);
    updateClock();
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function updateClock() {
    const el = document.getElementById("topbar-clock");
    const pill = document.getElementById("exam-timer-pill");
    if (!el || !session) return;
    const left = remaining();
    el.textContent = App.u.fmtClock(left === null ? session.seconds : left);
    if (pill) {
      pill.classList.toggle("countdown", left !== null);
      pill.classList.toggle("urgent", left !== null && left <= 300);
      pill.classList.toggle("critical", left !== null && left <= 60);
    }
  }

  function timeUp() {
    if (!session || expired) return;
    expired = true;
    stopTimer();
    bankQuestionTime();
    App.ui.toast("Time is up — submitting your answers.", "err");
    const v = document.createElement("div");
    v.className = "pause-veil";
    v.id = "timeup-veil";
    v.innerHTML =
      '<div class="card pause-card">' +
      '<div class="pause-ico" style="background:var(--bad-soft);color:var(--bad);border-color:var(--bad-line)">' + App.icon("clock", 26, 2.2) + "</div>" +
      '<div><div style="font-size:18px;font-weight:800;letter-spacing:-0.02em">Time expired</div>' +
      '<div style="font-size:12.5px;color:var(--muted);font-weight:500;margin-top:4px">Grading what you had at the buzzer.</div></div></div>';
    document.body.appendChild(v);
    setTimeout(function () {
      v.remove();
      /* the user may have bailed out during the countdown overlay */
      if (session && location.hash.indexOf("#/exam") === 0) View.finish();
      else expired = false;
    }, 1400);
  }

  View.togglePause = function () {
    if (!session || expired) return;
    paused = !paused;
    if (paused) { bankQuestionTime(); showPauseOverlay(); }
    else { markQuestionStart(); hidePauseOverlay(); }
    View.updateTopbar();
    throttledSave();
  };

  function showPauseOverlay() {
    if (document.getElementById("pause-veil")) return;
    const v = document.createElement("div");
    v.id = "pause-veil";
    v.className = "pause-veil";
    v.innerHTML =
      '<div class="card pause-card">' +
      '<div class="pause-ico">' + App.icon("pause", 26, 2.4) + "</div>" +
      '<div><div style="font-size:18px;font-weight:800;letter-spacing:-0.02em">Exam paused</div>' +
      '<div style="font-size:12.5px;color:var(--muted);font-weight:500;margin-top:4px">Take a breath — the clock is stopped.</div></div>' +
      '<button class="btn btn-primary btn-lg" id="pause-resume">' + App.icon("resume", 17) + "Resume exam</button>" +
      "</div>";
    document.body.appendChild(v);
    v.querySelector("#pause-resume").onclick = View.togglePause;
  }
  function hidePauseOverlay() {
    const v = document.getElementById("pause-veil");
    if (v) v.remove();
  }

  View.updateTopbar = function (hide) {
    const pill = document.getElementById("exam-timer-pill");
    if (!pill) return;
    const onExam = !hide && session && location.hash.indexOf("#/exam") === 0;
    pill.classList.toggle("show", !!onExam);
    pill.classList.toggle("paused", !!(onExam && paused));
    if (!onExam) {
      pill.classList.remove("countdown", "urgent", "critical");
      return;
    }
    updateClock();
  };

  /* ---------------- question rendering ---------------- */
  function renderQuestion() {
    const main = document.getElementById("exam-main");
    if (!main || !session) return;
    const u = App.u;
    const q = session.questions[session.index];
    const resp = session.responses[session.index];
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    let optsHtml = "";
    if (q.type === "matching") {
      session.responses[session.index] = resp || {};
      optsHtml = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:18px">' +
        q.leftItems.map(function (left, li) {
          const sel = (session.responses[session.index] || {})[li] || "";
          const opts = q.rightItems.map(function (r) {
            return '<option value="' + u.esc(r) + '"' + (sel === r ? " selected" : "") + ">" + u.esc(r) + "</option>";
          }).join("");
          return (
            '<div style="display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)">' +
            '<div style="font-size:12.5px;font-weight:700">' + u.esc(left) + "</div>" +
            '<select class="select match-sel" data-li="' + li + '"><option value="">— choose a match —</option>' + opts + "</select>" +
            "</div>"
          );
        }).join("") + "</div>";
    } else {
      optsHtml = '<div style="display:flex;flex-direction:column;gap:9px;margin-top:18px">' +
        q.options.map(function (opt, oi) {
          const sel = q.type === "single"
            ? resp === oi
            : Array.isArray(resp) && resp.indexOf(oi) !== -1;
          return (
            '<button class="opt-btn' + (sel ? " sel" : "") + '" data-oi="' + oi + '" aria-pressed="' + sel + '">' +
            '<span class="opt-letter">' + (sel ? App.icon("check", 12, 3) : letters[oi % 26]) + "</span>" +
            "<span>" + u.esc(opt) + "</span>" +
            '<span class="opt-key">' + (oi + 1) + "</span>" +
            "</button>"
          );
        }).join("") + "</div>";
    }

    const media = App.ui.media(q);

    const typeNote = q.type === "single" ? "Select one answer"
      : q.type === "multiple" ? "Select all that apply"
      : "Match each definition";

    main.innerHTML =
      '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">' +
      '<span class="chip chip-mut">Question ' + (session.index + 1) + " / " + session.questions.length + "</span>" +
      App.ui.typeChip(q.type) +
      '<span style="font-size:11px;color:var(--muted);font-weight:600">' + typeNote + "</span>" +
      '<button class="flag-btn' + (session.flags[session.index] ? " on" : "") + '" id="flag-btn" style="margin-left:auto">' +
      App.icon("flag", 14) + "<span>" + (session.flags[session.index] ? "Flagged" : "Flag") + "</span></button>" +
      "</div>" +
      '<h2 class="exam-q" style="margin-top:16px">' + u.esc(q.question) + "</h2>" +
      media + optsHtml +
      '<div class="exam-foot">' +
      '<span class="kbd-hint no-print">← → navigate · 1-9 select · F flag</span>' +
      '<div class="spacer">' +
      '<button class="btn btn-ghost" id="prev-btn" ' + (session.index === 0 ? "disabled" : "") + ">" + App.icon("chevL", 15) + "Prev</button>" +
      (session.index < session.questions.length - 1
        ? '<button class="btn btn-primary" id="next-btn">Next' + App.icon("chevR", 15) + "</button>"
        : '<button class="btn btn-ok" id="submit-btn">' + App.icon("check", 15) + "Submit exam</button>") +
      "</div></div>";

    /* wire */
    main.querySelectorAll(".opt-btn").forEach(function (btn) {
      btn.onclick = function () { selectOption(parseInt(btn.dataset.oi, 10)); };
    });
    main.querySelectorAll(".match-sel").forEach(function (sel) {
      sel.onchange = function () {
        session.responses[session.index][parseInt(sel.dataset.li, 10)] = sel.value;
        updateSide();
        throttledSave();
      };
    });
    const flagBtn = document.getElementById("flag-btn");
    if (flagBtn) flagBtn.onclick = View.toggleFlag;
    const prev = document.getElementById("prev-btn");
    if (prev) prev.onclick = function () { View.navigate(-1); };
    const next = document.getElementById("next-btn");
    if (next) next.onclick = function () { View.navigate(1); };
    const submit = document.getElementById("submit-btn");
    if (submit) submit.onclick = View.confirmSubmit;
  }

  function selectOption(oi) {
    if (paused || expired) return;
    const q = session.questions[session.index];
    if (q.type === "single") {
      session.responses[session.index] = oi;
    } else {
      const cur = Array.isArray(session.responses[session.index]) ? session.responses[session.index] : [];
      const at = cur.indexOf(oi);
      if (at === -1) cur.push(oi); else cur.splice(at, 1);
      session.responses[session.index] = cur;
    }
    renderQuestion();
    updateSide();
    throttledSave();
  }

  View.navigate = function (dir) {
    if (!session) return;
    const next = session.index + dir;
    if (next < 0 || next >= session.questions.length) return;
    bankQuestionTime();
    session.index = next;
    renderQuestion();
    updateSide();
    throttledSave();
  };

  View.goTo = function (i) {
    if (!session || i < 0 || i >= session.questions.length) return;
    bankQuestionTime();
    session.index = i;
    renderQuestion();
    updateSide();
    throttledSave();
  };

  View.toggleFlag = function () {
    if (!session) return;
    session.flags[session.index] = !session.flags[session.index];
    if (!session.flags[session.index]) delete session.flags[session.index];
    renderQuestion();
    updateSide();
    throttledSave();
  };

  /* ---------------- sidebar ---------------- */
  function renderSide() {
    const side = document.getElementById("exam-side");
    if (!side || !session) return;
    side.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:16px">' +
      "<div><div class='field-lbl' style='margin-bottom:4px'>Active exam</div>" +
      '<div style="font-size:13px;font-weight:800;word-break:break-word">' + App.u.esc(session.bankKey) + "</div>" +
      (session.label ? '<div class="exam-mode-tag">' + App.icon("bolt", 11, 2.2) + App.u.esc(session.label) + "</div>" : "") +
      (session.timeLimit ? '<div class="exam-mode-tag t-time">' + App.icon("clock", 11, 2.2) + App.u.fmtDuration(session.timeLimit) + " limit</div>" : "") +
      "</div>" +
      '<div class="progress-track"><div class="progress-fill" id="exam-progress"></div></div>' +
      '<div class="mini-stats">' +
      '<div class="mini-stat"><div class="ms-n" id="ms-answered" style="color:var(--acc)">0</div><div class="ms-l">Answered</div></div>' +
      '<div class="mini-stat"><div class="ms-n" id="ms-flagged" style="color:var(--warn)">0</div><div class="ms-l">Flagged</div></div>' +
      "</div>" +
      "<div><div class='field-lbl'>Questions</div>" +
      '<div class="qgrid" id="exam-qgrid" style="max-height:260px;overflow-y:auto"></div></div>' +
      '<button class="btn btn-ok btn-block" id="side-submit">' + App.icon("check", 15) + "Submit exam</button>" +
      '<button class="btn btn-danger btn-block" id="side-exit">' + App.icon("x", 14) + "Save & exit</button>" +
      "</div>";

    document.getElementById("side-submit").onclick = View.confirmSubmit;
    document.getElementById("side-exit").onclick = function () {
      App.ui.confirm({
        title: "Save & exit?",
        desc: "Your progress is stored and you can resume this exam anytime from the dashboard.",
        confirmLabel: "Save & exit"
      }, function () {
        saveSession();
        App.router.go("#/dashboard");
      });
    };
    updateSide();
  }

  function updateSide() {
    if (!session) return;
    const grid = document.getElementById("exam-qgrid");
    if (!grid) return;
    let answered = 0;
    const cells = session.questions.map(function (q, i) {
      const resp = session.responses[i];
      const isAns = q.type === "matching"
        ? resp && Object.keys(resp).some(function (k) { return resp[k]; })
        : resp !== undefined && (!Array.isArray(resp) || resp.length > 0);
      if (isAns) answered++;
      return (
        '<button class="qgrid-btn' + (isAns ? " ans" : "") + (i === session.index ? " cur" : "") + '" data-i="' + i + '">' +
        (i + 1) + (session.flags[i] ? '<span class="qd"></span>' : "") +
        "</button>"
      );
    });
    grid.innerHTML = cells.join("");
    grid.querySelectorAll(".qgrid-btn").forEach(function (b) {
      b.onclick = function () { View.goTo(parseInt(b.dataset.i, 10)); };
    });

    document.getElementById("ms-answered").textContent = answered;
    document.getElementById("ms-flagged").textContent = Object.keys(session.flags).length;
    const bar = document.getElementById("exam-progress");
    if (bar) bar.style.width = Math.round((answered / session.questions.length) * 100) + "%";
  }

  /* ---------------- submit & results ---------------- */
  View.confirmSubmit = function () {
    if (!session) return;
    let unanswered = 0;
    session.questions.forEach(function (q, i) {
      const resp = session.responses[i];
      const isAns = q.type === "matching"
        ? resp && Object.keys(resp).some(function (k) { return resp[k]; })
        : resp !== undefined && (!Array.isArray(resp) || resp.length > 0);
      if (!isAns) unanswered++;
    });
    const flagged = Object.keys(session.flags).length;
    const desc = unanswered
      ? "You still have " + unanswered + " unanswered question" + (unanswered > 1 ? "s" : "") + (flagged ? " and " + flagged + " flagged" : "") + ". Submit anyway?"
      : flagged ? "You have " + flagged + " flagged question" + (flagged > 1 ? "s" : "") + ". Submit now?" : "All questions answered — nice. Submit now?";
    App.ui.confirm({ title: "Submit exam?", desc: desc, confirmLabel: "Submit exam" }, View.finish);
  };

  View.finish = function () {
    if (!session) return;
    stopTimer();
    bankQuestionTime();
    const qs = session.questions;
    let correct = 0, incorrect = 0, skipped = 0;
    const perType = {
      single: { c: 0, t: 0 }, multiple: { c: 0, t: 0 }, matching: { c: 0, t: 0 }
    };
    const graded = qs.map(function (q, i) {
      const resp = session.responses[i];
      let isCorrect = false, isSkipped = false;
      if (q.type === "single") {
        isSkipped = resp === undefined;
        isCorrect = !isSkipped && q.correctIndices.indexOf(resp) !== -1;
      } else if (q.type === "multiple") {
        isSkipped = !resp || !resp.length;
        isCorrect = !isSkipped && resp.length === q.correctIndices.length &&
          resp.every(function (v) { return q.correctIndices.indexOf(v) !== -1; });
      } else {
        isSkipped = !resp || !Object.keys(resp).some(function (k) { return resp[k]; });
        isCorrect = !isSkipped && q.leftItems.every(function (_, li) { return resp[li] === q.correctAnswers[li]; });
      }
      perType[q.type].t++;
      if (isCorrect) { correct++; perType[q.type].c++; }
      else if (isSkipped) skipped++;
      else incorrect++;
      return {
        q: q, resp: resp, isCorrect: isCorrect, isSkipped: isSkipped,
        flagged: !!session.flags[i], ms: session.times[i] || 0,
        srcBank: session.origin && session.origin[i] ? session.origin[i].bank : session.bankKey
      };
    });

    const pct = Math.round((correct / qs.length) * 100);
    const passed = pct >= (session.passPct || 70);
    const answeredMs = graded.reduce(function (s, g) { return s + g.ms; }, 0);
    const median = medianOf(graded.map(function (g) { return g.ms; }).filter(function (m) { return m > 0; }));

    App.results = {
      bankKey: session.bankKey,
      label: session.label || "",
      isMixed: !!session.origin,
      graded: graded,
      correct: correct, incorrect: incorrect, skipped: skipped,
      total: qs.length, pct: pct, passed: passed,
      seconds: session.seconds, passPct: session.passPct || 70,
      perType: perType,
      timeLimit: session.timeLimit || 0,
      expired: expired,
      medianMs: median,
      answeredMs: answeredMs,
      prev: previousAttempt(session.bankKey)
    };

    /* mixed drills are not a bank — they get no history row of their own */
    if (!session.origin) {
      App.store.recordAttempt(session.bankKey, {
        ts: Date.now(), pct: pct, correct: correct, total: qs.length,
        seconds: session.seconds, passed: passed
      });
    }

    /* feed the scheduler and the per-question stats */
    graded.forEach(function (g) {
      const bank = g.srcBank;
      if (!App.store.getBank(bank)) return;
      const fast = g.ms > 0 && median > 0 && g.ms < median * 0.6;
      App.srs.gradeFromExam(bank, g.q.id, g.isCorrect && !g.isSkipped, fast);
      App.srs.record(bank, g.q.id, g.isCorrect, g.ms);
    });
    App.srs.logActivity({
      attempts: 1, answered: qs.length, correct: correct, seconds: session.seconds
    });

    session = null;
    expired = false;
    App.store.clearSession();
    App.router.go("#/results");
  };

  function medianOf(arr) {
    if (!arr.length) return 0;
    const a = arr.slice().sort(function (x, y) { return x - y; });
    const mid = a.length >> 1;
    return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
  }

  /* The attempt before this one, for the results delta. */
  function previousAttempt(bankKey) {
    const h = App.store.state.history[bankKey] || [];
    return h.length ? h[h.length - 1] : null;
  }

  /* ---------------- keyboard shortcuts ---------------- */
  function bindKeys() {
    unbindKeys();
    keyHandler = function (e) {
      if (!session) return;
      if (location.hash.indexOf("#/exam") !== 0) return;
      if (e.target.matches("input, textarea, select")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); View.navigate(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); View.navigate(1); }
      else if (e.key === "f" || e.key === "F") View.toggleFlag();
      else if (e.key === "Enter") {
        const next = document.getElementById("next-btn");
        const submit = document.getElementById("submit-btn");
        if (next) next.click(); else if (submit) submit.click();
      } else if (/^[1-9]$/.test(e.key)) {
        const oi = parseInt(e.key, 10) - 1;
        const q = session.questions[session.index];
        if (q.type !== "matching" && oi < q.options.length) selectOption(oi);
      }
    };
    document.addEventListener("keydown", keyHandler);
  }
  function unbindKeys() {
    if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
  }

  /* ---------------- custom exam builder (multi-bank) ---------------- */
  View.openBuilder = function () {
    const store = App.store, u = App.u;
    const names = store.bankNames();
    if (!names.length) { App.ui.toast("No banks available.", "err"); return; }

    const veil = App.ui.customModal(
      '<div class="modal-head"><div>' +
      '<div class="modal-title">' + App.icon("layers", 16) + ' Custom exam</div>' +
      '<div class="modal-sub">Pick one or more banks and configure the session.</div></div>' +
      '<button class="icon-btn" data-x>' + App.icon("x", 15) + "</button></div>" +

      '<div style="display:flex;flex-direction:column;gap:10px;margin:8px 0 14px;max-height:240px;overflow-y:auto" id="builder-banks">' +
      names.map(function (name) {
        const bank = store.getBank(name);
        return '<div class="build-bank-row" data-key="' + u.esc(name) + '">' +
          '<div class="bb-check"></div>' +
          '<div class="bb-name">' + u.esc(name) + '</div>' +
          '<div class="bb-count">' + bank.questions.length + ' q</div></div>';
      }).join("") +
      "</div>" +

      '<div style="display:flex;flex-direction:column;gap:14px">' +
      "<div><label class='field-lbl'>Questions per bank</label><select class='select' id='build-limit'>" +
      '<option value="all">All questions</option><option value="10">10 per bank</option><option value="20">20 per bank</option><option value="50">50 per bank</option></select></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      "<div><label class='field-lbl'>Time limit</label><select class='select' id='build-time'>" +
      '<option value="0" selected>No limit</option><option value="1800">30 minutes</option>' +
      '<option value="3600">60 minutes</option><option value="5400">90 minutes</option>' +
      '<option value="pace">90s per question</option></select></div>' +
      "<div><label class='field-lbl'>Pass threshold</label><select class='select' id='build-pass'>" +
      '<option value="50">50%</option><option value="70" selected>70%</option><option value="80">80%</option><option value="90">90%</option></select></div></div>' +
      '<div class="switch-row"><div><div class="sr-txt">Shuffle questions</div><div class="sr-sub">Randomize all question order.</div></div>' +
      '<label class="switch"><input type="checkbox" id="build-shuf" checked><span class="track"></span><span class="thumb"></span></label></div>' +
      "</div>" +

      '<div class="modal-foot">' +
      '<button class="btn btn-ghost" data-x>Cancel</button>' +
      '<button class="btn btn-primary" id="build-go">' + App.icon("play", 15) + "Start custom exam</button>" +
      "</div>"
    );

    veil.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = App.ui.closeModal; });
    veil.querySelectorAll(".build-bank-row").forEach(function (row) {
      row.onclick = function () { row.classList.toggle("sel"); };
    });

    veil.querySelector("#build-go").onclick = function () {
      const selected = veil.querySelectorAll(".build-bank-row.sel");
      if (!selected.length) { App.ui.toast("Select at least one bank.", "err"); return; }
      const limit = veil.querySelector("#build-limit").value;
      const passPct = parseInt(veil.querySelector("#build-pass").value, 10);
      const shuf = veil.querySelector("#build-shuf").checked;
      App.ui.closeModal();

      let allQs = [];
      let allOrigin = [];
      let bankLabel = "";
      selected.forEach(function (row) {
        const key = row.dataset.key;
        const bank = store.getBank(key);
        if (!bank) return;
        bankLabel += (bankLabel ? " + " : "") + key;
        let src = bank.questions;
        if (limit !== "all") src = src.slice(0, parseInt(limit, 10));
        src.forEach(function (q) {
          allQs.push(cloneQuestion(q));
          allOrigin.push({ bank: key, id: q.id });
        });
      });
      if (!allQs.length) { App.ui.toast("No questions selected.", "err"); return; }
      if (shuf) {
        const order = App.u.shuffle(allQs.map(function (_, i) { return i; }));
        allQs = order.map(function (i) { return allQs[i]; });
        allOrigin = order.map(function (i) { return allOrigin[i]; });
      }

      startSession({
        bankKey: bankLabel,
        label: selected.length > 1 ? "Custom exam · " + selected.length + " banks" : "",
        questions: allQs,
        origin: allOrigin,
        passPct: passPct || 70,
        timeLimit: resolveTimeLimit(veil.querySelector("#build-time").value, allQs.length)
      });
    };
  };

  App.views.exam = View;
})();
