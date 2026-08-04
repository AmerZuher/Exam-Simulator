/* ExamPro — Practice Mode: per-question "check as you go", untimed.
 *
 * Unlike Exam mode (submit everything at the end) or QA Review (answers
 * shown from the start, no attempt at all), Practice Mode lets the user
 * answer freely, then optionally request the correct answer for the
 * question they're on — once checked, that question locks: no more
 * re-answering, just confirmation of right/wrong plus its explanation
 * (if one exists). Navigation stays free the whole time; a question left
 * unchecked is simply graded normally when the session finishes, same as
 * an unflagged answer in Exam mode. Ends in the same results page Exam
 * mode uses (see App.results contract in exam.js/results.js), just with
 * `mode: "practice"` so Results can retake into the right mode.
 */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Practice session", sub: "Check your answers as you go" };

  let session = null;
  let keyHandler = null;
  let qStart = 0;
  let leavingExplicitly = false;

  /* ---- per-question stopwatch (same idea as exam.js, no pause state to consider) ---- */
  function markQuestionStart() { qStart = Date.now(); }
  function bankQuestionTime() {
    if (!session || !qStart) { qStart = Date.now(); return; }
    const ms = Date.now() - qStart;
    if (ms > 0 && ms < 30 * 60 * 1000) {
      session.times[session.index] = (session.times[session.index] || 0) + ms;
    }
    qStart = Date.now();
  }

  const saveSession = function () {
    if (!session) return;
    App.store.state.practiceSession = session;
    App.store.savePracticeSession();
  };
  const throttledSave = function () {
    if (!View._th) View._th = App.u.throttle(saveSession, 800);
    View._th();
  };

  /* ---------------- setup modal ---------------- */
  View.openSetup = function (bankKey) {
    const store = App.store, u = App.u, shared = App.examShared;
    const bank = store.getBank(bankKey);
    if (!bank) { App.ui.toast("Bank not found.", "err"); return; }
    const total = bank.questions.length;

    const poolOpts = Object.keys(shared.POOLS).map(function (k) {
      const n = shared.poolCount(bankKey, k);
      return '<option value="' + k + '"' + (k === "all" ? " selected" : "") + (n ? "" : " disabled") + ">" +
        shared.POOLS[k].label + " (" + n + ")</option>";
    }).join("");

    const brackets = [5, 10, 20, 50, 100, 150].filter(function (n) { return n < total; });
    const limitOpts = '<option value="all" selected>No cap — use the whole pool</option>' +
      brackets.map(function (n) { return '<option value="' + n + '">Cap at ' + n + " questions</option>"; }).join("");

    const veil = App.ui.customModal(
      '<div class="modal-head"><div>' +
      '<div class="modal-title">Configure practice session</div>' +
      '<div class="modal-sub">' + u.esc(bankKey) + " · " + total + " questions available</div>" +
      "</div>" +
      '<button class="icon-btn" data-x>' + App.icon("x", 15) + "</button></div>" +

      '<div style="display:flex;flex-direction:column;gap:14px">' +
      "<div><label class='field-lbl'>Question pool</label><select class='select' id='psetup-pool'>" + poolOpts + "</select>" +
      "<div class='field-hint' id='psetup-pool-hint'></div></div>" +
      "<div><label class='field-lbl'>Session length</label><select class='select' id='psetup-limit'>" + limitOpts + "</select></div>" +
      "<div><label class='field-lbl'>Pass threshold</label><select class='select' id='psetup-pass'>" +
      '<option value="50">50% — casual</option><option value="70" selected>70% — standard</option><option value="80">80% — strict</option><option value="90">90% — expert</option></select></div>' +
      '<div class="switch-row"><div><div class="sr-txt">Shuffle question order</div><div class="sr-sub">Randomize the sequence of questions.</div></div>' +
      '<label class="switch"><input type="checkbox" id="psetup-shufq" checked><span class="track"></span><span class="thumb"></span></label></div>' +
      '<div class="switch-row"><div><div class="sr-txt">Shuffle answer options</div><div class="sr-sub">Randomize option order (correct answers are re-mapped).</div></div>' +
      '<label class="switch"><input type="checkbox" id="psetup-shufo"><span class="track"></span><span class="thumb"></span></label></div>' +
      "</div>" +

      '<div class="modal-foot">' +
      '<button class="btn btn-ghost" data-x>Cancel</button>' +
      '<button class="btn btn-primary" id="psetup-go">' + App.icon("brain", 15) + "Start practice</button>" +
      "</div>"
    );

    const poolSel = veil.querySelector("#psetup-pool");
    const hint = veil.querySelector("#psetup-pool-hint");
    function refreshHint() {
      const n = shared.poolCount(bankKey, poolSel.value);
      hint.textContent = n ? n + " question" + (n === 1 ? "" : "s") + " in this pool." : "This pool is empty right now.";
    }
    poolSel.onchange = refreshHint;
    refreshHint();
    App.components.enhanceSelects(veil);

    veil.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = App.ui.closeModal; });
    veil.querySelector("#psetup-go").onclick = function () {
      const pool = poolSel.value;
      if (!shared.poolCount(bankKey, pool)) { App.ui.toast("That pool has no questions.", "err"); return; }
      App.ui.closeModal();
      launch(bankKey, {
        pool: pool,
        limit: veil.querySelector("#psetup-limit").value,
        passPct: parseInt(veil.querySelector("#psetup-pass").value, 10),
        shuffleQuestions: veil.querySelector("#psetup-shufq").checked,
        shuffleOptions: veil.querySelector("#psetup-shufo").checked
      });
    };
  };

  function launch(bankKey, cfg) {
    const shared = App.examShared;
    const bank = App.store.getBank(bankKey);
    if (!bank) return;

    let qs = shared.resolvePool(bankKey, cfg.pool || "all").map(shared.cloneQuestion);
    if (cfg.shuffleOptions) qs = qs.map(shared.shuffleQuestionOptions);
    if (cfg.shuffleQuestions) qs = App.u.shuffle(qs);
    if (cfg.limit && cfg.limit !== "all") qs = qs.slice(0, parseInt(cfg.limit, 10));
    if (!qs.length) { App.ui.toast("This bank has no questions.", "err"); return; }

    startSession({
      bankKey: bankKey,
      label: cfg.label || (cfg.pool && cfg.pool !== "all" ? shared.POOLS[cfg.pool].label.split(" — ")[0] : ""),
      questions: qs,
      passPct: cfg.passPct || 70
    });
  }

  function startSession(spec) {
    session = {
      bankKey: spec.bankKey,
      label: spec.label || "",
      questions: spec.questions,
      index: 0,
      responses: {},
      checked: {},    // index -> true once locked in
      results: {},    // index -> { isCorrect, isSkipped } cached at check time
      times: {},
      passPct: spec.passPct || 70,
      startedAt: Date.now()
    };
    saveSession();
    App.router.go("#/practice");
  }

  /* ---------------- resume ---------------- */
  View.resumeSession = function () {
    const s = App.store.state.practiceSession;
    if (!s || !App.store.getBank(s.bankKey)) {
      App.store.clearPracticeSession();
      App.ui.toast("Saved practice session is no longer valid.", "err");
      return;
    }
    session = normalizeSession(s);
    App.router.go("#/practice");
    App.ui.toast("Practice session restored.", "info");
  };

  function normalizeSession(s) {
    if (!s.times) s.times = {};
    if (!s.checked) s.checked = {};
    if (!s.results) s.results = {};
    if (s.label == null) s.label = "";
    return s;
  }

  /* ---------------- render ---------------- */
  View.render = function (root) {
    if (!session) {
      const saved = App.store.state.practiceSession;
      if (saved && App.store.getBank(saved.bankKey)) session = normalizeSession(saved);
      else { App.router.go("#/dashboard"); return; }
    }
    markQuestionStart();

    root.innerHTML =
      '<div class="view exam-layout">' +
      '<section class="card card-pad exam-main rise" id="practice-main"></section>' +
      '<aside class="card card-pad rise" style="animation-delay:.07s" id="practice-side"></aside>' +
      "</div>";

    renderSide();
    renderQuestion();
    bindKeys();
  };

  View.destroy = function () {
    if (session) bankQuestionTime();
    unbindKeys();
    if (session) {
      saveSession();
      if (!leavingExplicitly) App.ui.toast("Progress saved — resume anytime from the dashboard.", "info");
    }
    leavingExplicitly = false;
  };

  /* ---------------- question rendering ---------------- */
  function renderQuestion() {
    const main = document.getElementById("practice-main");
    if (!main || !session) return;
    const u = App.u, shared = App.examShared;
    const q = session.questions[session.index];
    const resp = session.responses[session.index];
    const checked = !!session.checked[session.index];
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    let bodyHtml;
    if (checked) {
      bodyHtml = shared.answerReviewHtml(q, resp);
    } else if (q.type === "matching") {
      session.responses[session.index] = resp || {};
      bodyHtml = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:18px">' +
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
      bodyHtml = '<div style="display:flex;flex-direction:column;gap:9px;margin-top:18px">' +
        q.options.map(function (opt, oi) {
          const sel = q.type === "single" ? resp === oi : Array.isArray(resp) && resp.indexOf(oi) !== -1;
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
    const grade = checked ? session.results[session.index] : null;

    const feedbackHtml = checked
      ? '<div class="practice-feedback ' + (grade.isCorrect ? "ok" : "bad") + '">' +
        App.icon(grade.isCorrect ? "check" : "x", 15, 2.6) +
        "<span>" + (grade.isCorrect ? "Correct!" : "Not quite — the correct answer is highlighted above.") + "</span></div>"
      : "";

    const explainHtml = (checked && q.explanation)
      ? '<div class="explain-box"><div class="explain-box-head">' + App.icon("lightbulb", 14) + "<span>Explanation</span></div>" +
        (q.explanation.correct ? "<p>" + u.esc(q.explanation.correct) + "</p>" : "") +
        (q.explanation.incorrect && q.explanation.incorrect.length
          ? "<ul>" + q.explanation.incorrect.map(function (t) { return "<li>" + u.esc(t) + "</li>"; }).join("") + "</ul>"
          : "") +
        "</div>"
      : "";

    const isLast = session.index === session.questions.length - 1;
    const answered = shared.isAnswered(q, resp);

    main.innerHTML =
      '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">' +
      '<span class="chip chip-mut">Question ' + (session.index + 1) + " / " + session.questions.length + "</span>" +
      App.ui.typeChip(q.type) +
      '<span style="font-size:11px;color:var(--muted);font-weight:600">' + typeNote + "</span>" +
      (checked ? '<span class="chip ' + (grade.isCorrect ? "chip-ok" : "chip-bad") + '" style="margin-left:auto">' + (grade.isCorrect ? "Correct" : "Incorrect") + "</span>" : "") +
      "</div>" +
      '<h2 class="exam-q" style="margin-top:16px">' + u.esc(q.question) + "</h2>" +
      media + bodyHtml + feedbackHtml + explainHtml +
      '<div class="exam-foot">' +
      '<span class="kbd-hint no-print">← → navigate' + (checked ? "" : " · 1-9 select · Enter checks") + "</span>" +
      '<div class="spacer">' +
      (checked ? "" : '<button class="btn btn-primary" id="check-btn"' + (answered ? "" : " disabled") + '>' + App.icon("check", 15) + "Check answer</button>") +
      '<button class="btn btn-ghost" id="prev-btn" ' + (session.index === 0 ? "disabled" : "") + ">" + App.icon("chevL", 15) + "Prev</button>" +
      (isLast
        ? '<button class="btn btn-ok" id="finish-btn">' + App.icon("check", 15) + "Finish practice</button>"
        : '<button class="btn btn-soft" id="next-btn">Next' + App.icon("chevR", 15) + "</button>") +
      "</div></div>";

    /* wire */
    if (!checked) {
      main.querySelectorAll(".opt-btn").forEach(function (btn) {
        btn.onclick = function () { selectOption(parseInt(btn.dataset.oi, 10)); };
      });
      main.querySelectorAll(".match-sel").forEach(function (sel) {
        sel.onchange = function () {
          session.responses[session.index][parseInt(sel.dataset.li, 10)] = sel.value;
          renderQuestion();
          updateSide();
          throttledSave();
        };
      });
      App.components.enhanceSelects(main);
    }
    const checkBtn = document.getElementById("check-btn");
    if (checkBtn) checkBtn.onclick = function () { performCheck(session.index); };
    const prev = document.getElementById("prev-btn");
    if (prev) prev.onclick = function () { View.navigate(-1); };
    const next = document.getElementById("next-btn");
    if (next) next.onclick = function () { View.navigate(1); };
    const finishBtn = document.getElementById("finish-btn");
    if (finishBtn) finishBtn.onclick = View.confirmFinish;
  }

  function selectOption(oi) {
    if (!session || session.checked[session.index]) return;
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

  /* The core new interaction: grade this one question right now, lock it,
     and feed the scheduler immediately — same spirit as Review mode grading
     a flashcard the moment it's answered, rather than exam.js's grade-
     everything-at-the-end batch. */
  function performCheck(i) {
    if (!session || session.checked[i]) return;
    const q = session.questions[i];
    const resp = session.responses[i];
    if (!App.examShared.isAnswered(q, resp)) return;
    bankQuestionTime();
    const grade = App.examShared.gradeQuestion(q, resp);
    session.checked[i] = true;
    session.results[i] = grade;
    if (App.store.getBank(session.bankKey)) {
      App.srs.gradeFromExam(session.bankKey, q.id, grade.isCorrect, false);
      App.srs.record(session.bankKey, q.id, grade.isCorrect, session.times[i] || 0);
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

  /* ---------------- sidebar ---------------- */
  function renderSide() {
    const side = document.getElementById("practice-side");
    if (!side || !session) return;
    side.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:16px">' +
      "<div><div class='field-lbl' style='margin-bottom:4px'>Practice session</div>" +
      '<div style="font-size:13px;font-weight:800;word-break:break-word">' + App.u.esc(session.bankKey) + "</div>" +
      (session.label ? '<div class="exam-mode-tag">' + App.icon("bolt", 11, 2.2) + App.u.esc(session.label) + "</div>" : "") +
      "</div>" +
      '<div class="progress-track"><div class="progress-fill" id="practice-progress"></div></div>' +
      '<div class="mini-stats">' +
      '<div class="mini-stat"><div class="ms-n" id="ms-checked" style="color:var(--acc)">0</div><div class="ms-l">Checked</div></div>' +
      '<div class="mini-stat"><div class="ms-n" id="ms-correct" style="color:var(--ok)">0</div><div class="ms-l">Correct</div></div>' +
      "</div>" +
      "<div><div class='field-lbl'>Questions</div>" +
      '<div class="qgrid" id="practice-qgrid" style="max-height:260px;overflow-y:auto"></div></div>' +
      '<button class="btn btn-ok btn-block" id="side-finish">' + App.icon("check", 15) + "Finish practice</button>" +
      '<button class="btn btn-danger btn-block" id="side-exit">' + App.icon("x", 14) + "Save & exit</button>" +
      "</div>";

    document.getElementById("side-finish").onclick = View.confirmFinish;
    document.getElementById("side-exit").onclick = function () {
      App.ui.confirm({
        title: "Save & exit?",
        desc: "Your progress is stored and you can resume this practice session anytime from the dashboard.",
        confirmLabel: "Save & exit"
      }, function () {
        leavingExplicitly = true;
        saveSession();
        App.router.go("#/dashboard");
      });
    };
    updateSide();
  }

  function updateSide() {
    if (!session) return;
    const grid = document.getElementById("practice-qgrid");
    if (!grid) return;
    let checkedCount = 0, correctCount = 0;
    const cells = session.questions.map(function (q, i) {
      const isChecked = !!session.checked[i];
      let cls = "qgrid-btn";
      if (isChecked) {
        checkedCount++;
        if (session.results[i].isCorrect) { correctCount++; cls += " ok"; }
        else cls += " bad";
      } else if (App.examShared.isAnswered(q, session.responses[i])) {
        cls += " ans";
      }
      if (i === session.index) cls += " cur";
      return '<button class="' + cls + '" data-i="' + i + '">' + (i + 1) + "</button>";
    });
    grid.innerHTML = cells.join("");
    grid.querySelectorAll(".qgrid-btn").forEach(function (b) {
      b.onclick = function () { View.goTo(parseInt(b.dataset.i, 10)); };
    });

    document.getElementById("ms-checked").textContent = checkedCount;
    document.getElementById("ms-correct").textContent = correctCount;
    const bar = document.getElementById("practice-progress");
    if (bar) bar.style.width = Math.round((checkedCount / session.questions.length) * 100) + "%";
  }

  /* ---------------- finish & results ---------------- */
  View.confirmFinish = function () {
    if (!session) return;
    let unanswered = 0, uncheckedAnswered = 0;
    session.questions.forEach(function (q, i) {
      if (!App.examShared.isAnswered(q, session.responses[i])) unanswered++;
      else if (!session.checked[i]) uncheckedAnswered++;
    });
    const parts = [];
    if (unanswered) parts.push(unanswered + " unanswered question" + (unanswered > 1 ? "s" : ""));
    if (uncheckedAnswered) parts.push(uncheckedAnswered + " answered but never checked");
    const desc = parts.length
      ? "You still have " + parts.join(" and ") + ". Finish anyway?"
      : "Every question is answered and checked — nice. Finish now?";
    App.ui.confirm({ title: "Finish practice?", desc: desc, confirmLabel: "Finish practice" }, View.finish);
  };

  View.finish = function () {
    if (!session) return;
    bankQuestionTime();
    const shared = App.examShared;
    const qs = session.questions;
    let correct = 0, incorrect = 0, skipped = 0;
    const perType = { single: { c: 0, t: 0 }, multiple: { c: 0, t: 0 }, matching: { c: 0, t: 0 } };

    const graded = qs.map(function (q, i) {
      const resp = session.responses[i];
      const grade = session.checked[i] ? session.results[i] : shared.gradeQuestion(q, resp);
      perType[q.type].t++;
      if (grade.isCorrect) { correct++; perType[q.type].c++; }
      else if (grade.isSkipped) skipped++;
      else incorrect++;

      /* checked questions already fed the scheduler live in performCheck();
         anything left unchecked (answered or not) still needs to reach it once. */
      if (!session.checked[i] && App.store.getBank(session.bankKey)) {
        App.srs.gradeFromExam(session.bankKey, q.id, grade.isCorrect, false);
        App.srs.record(session.bankKey, q.id, grade.isCorrect, session.times[i] || 0);
      }

      return {
        q: q, resp: resp, isCorrect: grade.isCorrect, isSkipped: grade.isSkipped,
        flagged: false, ms: session.times[i] || 0, srcBank: session.bankKey
      };
    });

    const pct = Math.round((correct / qs.length) * 100);
    const passed = pct >= (session.passPct || 70);
    const seconds = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));
    const answeredMs = graded.reduce(function (s, g) { return s + g.ms; }, 0);
    const median = shared.medianOf(graded.map(function (g) { return g.ms; }).filter(function (m) { return m > 0; }));

    App.results = {
      bankKey: session.bankKey,
      label: session.label || "",
      isMixed: false,
      mode: "practice",
      graded: graded,
      correct: correct, incorrect: incorrect, skipped: skipped,
      total: qs.length, pct: pct, passed: passed,
      seconds: seconds, passPct: session.passPct || 70,
      perType: perType,
      timeLimit: 0, expired: false,
      medianMs: median, answeredMs: answeredMs,
      prev: previousAttempt(session.bankKey)
    };

    App.store.recordAttempt(session.bankKey, {
      ts: Date.now(), pct: pct, correct: correct, total: qs.length, seconds: seconds, passed: passed
    });
    App.srs.logActivity({ attempts: 1, answered: qs.length, correct: correct, seconds: seconds });

    session = null;
    App.store.clearPracticeSession();
    App.router.go("#/results");
  };

  function previousAttempt(bankKey) {
    const h = App.store.state.history[bankKey] || [];
    return h.length ? h[h.length - 1] : null;
  }

  /* ---------------- keyboard shortcuts ---------------- */
  function bindKeys() {
    unbindKeys();
    keyHandler = function (e) {
      if (!session) return;
      if (location.hash.indexOf("#/practice") !== 0) return;
      if (e.target.matches("input, textarea, select")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); View.navigate(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); View.navigate(1); }
      else if (e.key === "Enter") {
        const checkBtn = document.getElementById("check-btn");
        const nextBtn = document.getElementById("next-btn");
        const finishBtn = document.getElementById("finish-btn");
        if (checkBtn && !checkBtn.disabled) checkBtn.click();
        else if (nextBtn) nextBtn.click();
        else if (finishBtn) finishBtn.click();
      } else if (/^[1-9]$/.test(e.key)) {
        const oi = parseInt(e.key, 10) - 1;
        const q = session.questions[session.index];
        if (!session.checked[session.index] && q.type !== "matching" && oi < q.options.length) selectOption(oi);
      }
    };
    document.addEventListener("keydown", keyHandler);
  }
  function unbindKeys() {
    if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
  }

  App.views.practice = View;
})();
