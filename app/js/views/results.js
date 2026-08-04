/* ExamPro — Results view: score, per-type accuracy, full answer review */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Results", sub: "How the session went" };
  let filter = "all";

  View.render = function (root) {
    const R = App.results;
    if (!R) { App.router.go("#/dashboard"); return; }
    filter = "all";

    const u = App.u, ui = App.ui;
    const circ = 2 * Math.PI * 62;

    const typeRows = ["single", "multiple", "matching"].filter(function (t) { return R.perType[t].t > 0; }).map(function (t) {
      const d = R.perType[t];
      const pct = d.t ? Math.round((d.c / d.t) * 100) : 0;
      const color = t === "single" ? "var(--acc)" : t === "multiple" ? "var(--warn)" : "var(--teal)";
      return (
        '<div class="acc-bar-row"><span class="ab-l">' + ui.typeLabel(t) + "</span>" +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + "%;background:" + color + '"></div></div>' +
        '<span class="ab-n">' + d.c + "/" + d.t + "</span></div>"
      );
    }).join("");

    root.innerHTML =
      '<div class="view">' +
      '<section class="card results-hero rise">' +
      '<div class="ring-wrap">' +
      '<svg class="ring-svg" width="150" height="150" viewBox="0 0 150 150">' +
      '<circle class="ring-track" cx="75" cy="75" r="62" fill="none" stroke-width="10"/>' +
      '<circle class="ring-val" id="res-ring" cx="75" cy="75" r="62" fill="none" stroke="' + (R.passed ? "var(--ok)" : "var(--bad)") + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '" transform="rotate(-90 75 75)"/>' +
      "</svg>" +
      '<div class="ring-label"><div class="ring-pct" id="res-pct">0%</div><div class="ring-sub">' + (R.passed ? "Passed" : "Score") + "</div></div>" +
      "</div>" +
      '<div style="min-width:0;width:100%">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<h2 style="font-size:21px;font-weight:800;letter-spacing:-0.03em">' + (R.passed ? "Excellent work — passed!" : "Keep practicing — not there yet") + "</h2>" +
      '<span class="chip ' + (R.passed ? "chip-ok" : "chip-bad") + '">' + (R.passed ? "Passed" : "Below " + R.passPct + "%") + "</span>" +
      "</div>" +
      '<p style="font-size:12.5px;color:var(--muted);font-weight:500;margin-top:5px">' +
      u.esc(R.bankKey) + (R.label ? " · " + u.esc(R.label) : "") + " · completed in " + u.fmtDuration(R.seconds) +
      (R.expired ? ' · <span style="color:var(--bad);font-weight:700">time expired</span>' : "") + "</p>" +
      deltaHtml(R) +
      '<div class="mini-stats" style="grid-template-columns:repeat(4,1fr);margin-top:16px;max-width:460px">' +
      '<div class="mini-stat"><div class="ms-n" style="color:var(--ok)">' + R.correct + '</div><div class="ms-l">Correct</div></div>' +
      '<div class="mini-stat"><div class="ms-n" style="color:var(--bad)">' + R.incorrect + '</div><div class="ms-l">Incorrect</div></div>' +
      '<div class="mini-stat"><div class="ms-n" style="color:var(--muted)">' + R.skipped + '</div><div class="ms-l">Skipped</div></div>' +
      '<div class="mini-stat"><div class="ms-n" style="color:var(--acc)">' + paceLabel(R) + '</div><div class="ms-l">Per question</div></div>' +
      "</div>" +
      '<div class="acc-bars" style="margin-top:16px;max-width:460px">' + typeRows + "</div>" +
      '<div style="display:flex;gap:9px;margin-top:20px;flex-wrap:wrap">' +
      (missedIds(R).length ? '<button class="btn btn-primary" data-act="drill">' + App.icon("bolt", 15) + "Drill the " + missedIds(R).length + " you missed</button>" : "") +
      '<button class="btn btn-soft" data-act="retake">' + App.icon("refresh", 15) + (R.mode === "practice" ? "Retake in Practice Mode" : "Retake exam") + "</button>" +
      '<button class="btn btn-ghost" data-act="study">' + App.icon("study", 15) + "Q&A preview</button>" +
      '<button class="btn btn-ghost" data-act="progress">' + App.icon("chart", 15) + "Progress</button>" +
      '<button class="btn btn-ghost" data-act="export">' + App.icon("download", 15) + "Report</button>" +
      "</div>" +
      "</div></section>" +

      paceSectionHtml(R) +

      '<div class="sec-head"><h3>Answer review</h3><span class="count-badge" id="rev-count"></span>' +
      '<div class="sec-actions" id="rev-filters">' +
      revChip("all", "All") + revChip("incorrect", "Incorrect") + revChip("skipped", "Skipped") + revChip("flagged", "Flagged") +
      "</div></div>" +
      '<section id="review-list" style="display:flex;flex-direction:column;gap:14px"></section>' +
      "</div>";

    /* animate ring + pct */
    requestAnimationFrame(function () {
      const ring = document.getElementById("res-ring");
      if (ring) ring.style.strokeDashoffset = (circ - (circ * R.pct) / 100).toFixed(1);
      const pctEl = document.getElementById("res-pct");
      if (pctEl) u.countUp(pctEl, R.pct, { suffix: "%", duration: 1200 });
    });

    if (R.passed && R.pct >= 80) setTimeout(ui.confetti, 450);

    const wrap = root.firstElementChild;
    u.on(wrap, "click", "[data-act]", function (e, el) {
      const act = el.dataset.act;
      if (act === "retake") {
        if (R.isMixed) App.ui.toast("Mixed drills can't be retaken directly — rebuild it from Progress.", "info");
        else if (R.mode === "practice") App.views.practice.openSetup(R.bankKey);
        else App.views.exam.openSetup(R.bankKey);
      } else if (act === "study") {
        if (R.isMixed) App.router.go("#/progress");
        else App.router.go("#/study/" + encodeURIComponent(R.bankKey));
      } else if (act === "progress") App.router.go("#/progress");
      else if (act === "dash") App.router.go("#/dashboard");
      else if (act === "export") exportReport(R);
      else if (act === "drill") {
        const missed = R.graded.filter(function (g) { return !g.isCorrect; });
        App.views.exam.launchMixed(
          missed.map(function (g) { return { bank: g.srcBank, id: g.q.id }; }),
          { label: "Missed from " + R.bankKey, passPct: 100 }
        );
      }
    });

    wrap.querySelectorAll("#rev-filters .fchip").forEach(function (chip) {
      chip.onclick = function () {
        filter = chip.dataset.f;
        root.querySelectorAll("#rev-filters .fchip").forEach(function (c) { c.classList.toggle("on", c === chip); });
        renderReview();
      };
    });

    renderReview();
  };

  function revChip(val, label) {
    return '<button class="fchip' + (filter === val ? " on" : "") + '" data-f="' + val + '">' + label + "</button>";
  }

  function missedIds(R) {
    return R.graded.filter(function (g) { return !g.isCorrect; });
  }

  function paceLabel(R) {
    if (!R.total) return "—";
    const per = Math.round(R.seconds / R.total);
    return per < 60 ? per + "s" : Math.floor(per / 60) + "m " + (per % 60) + "s";
  }

  /* Change against the previous attempt on this bank. */
  function deltaHtml(R) {
    if (!R.prev) return "";
    const d = R.pct - R.prev.pct;
    if (d === 0) return '<div class="res-delta flat">' + App.icon("arrowR", 13, 2.2) + "Same score as your last attempt</div>";
    const up = d > 0;
    return '<div class="res-delta ' + (up ? "up" : "dn") + '">' +
      (up ? "▲" : "▼") + " " + Math.abs(d) + " point" + (Math.abs(d) === 1 ? "" : "s") + " " +
      (up ? "better" : "lower") + " than your last attempt (" + R.prev.pct + "%)</div>";
  }

  /* Where the clock actually went: the slowest questions, and whether the
     slow ones were the wrong ones. */
  function paceSectionHtml(R) {
    const u = App.u;
    const timed = R.graded.filter(function (g) { return g.ms > 0; });
    if (timed.length < 3) return "";

    const slow = timed.slice().sort(function (a, b) { return b.ms - a.ms; }).slice(0, 5);
    const maxMs = slow[0].ms;
    const slowWrong = slow.filter(function (g) { return !g.isCorrect; }).length;
    const fastPool = timed.slice().sort(function (a, b) { return a.ms - b.ms; }).slice(0, Math.ceil(timed.length / 3));
    const fastAcc = fastPool.length
      ? Math.round((fastPool.filter(function (g) { return g.isCorrect; }).length / fastPool.length) * 100) : 0;

    const verdict = slowWrong >= 3
      ? "The questions that ate the clock are also the ones you got wrong — that is a knowledge gap, not a pacing problem."
      : fastAcc < 60
        ? "Your quickest answers were your least accurate (" + fastAcc + "% right). Slowing down on the easy-looking ones should pay off."
        : "Your pace held up: the slow questions were mostly still correct.";

    const rows = slow.map(function (g) {
      const pct = Math.round((g.ms / maxMs) * 100);
      return '<div class="pace-row">' +
        '<div class="pace-bar"><i style="width:' + pct + "%;background:" + (g.isCorrect ? "var(--ok)" : "var(--bad)") + '"></i></div>' +
        '<div class="pace-q">' + u.esc(g.q.question) + "</div>" +
        '<div class="pace-t mono">' + u.fmtDuration(Math.round(g.ms / 1000)) + "</div></div>";
    }).join("");

    return (
      '<section class="card card-pad rise" style="margin:18px 0">' +
      '<div class="chart-head"><div><h3>Pace analysis</h3>' +
      '<p class="chart-sub">Median ' + u.fmtDuration(Math.round(R.medianMs / 1000)) + " per question · " +
      u.fmtDuration(Math.round(R.answeredMs / 1000)) + " actively on questions</p></div></div>" +
      '<p class="pace-verdict">' + verdict + "</p>" +
      '<div class="pace-list">' + rows + "</div></section>"
    );
  }

  /* Plain-text attempt report — easy to paste into notes or a tracker. */
  function exportReport(R) {
    const u = App.u;
    const lines = [
      "ExamPro — attempt report",
      "Bank:      " + R.bankKey + (R.label ? "  (" + R.label + ")" : ""),
      "Date:      " + new Date().toLocaleString(),
      "Score:     " + R.pct + "%  (" + R.correct + "/" + R.total + ")  —  " + (R.passed ? "PASSED" : "below " + R.passPct + "%"),
      "Time:      " + u.fmtDuration(R.seconds) + (R.timeLimit ? " of " + u.fmtDuration(R.timeLimit) + " allowed" : "") + (R.expired ? "  (expired)" : ""),
      "Breakdown: " + R.correct + " correct · " + R.incorrect + " incorrect · " + R.skipped + " skipped",
      ""
    ];
    ["single", "multiple", "matching"].forEach(function (t) {
      const d = R.perType[t];
      if (d.t) lines.push("  " + App.ui.typeLabel(t) + ": " + d.c + "/" + d.t);
    });
    lines.push("", "Questions missed", "-----------------");
    R.graded.forEach(function (g, i) {
      if (g.isCorrect) return;
      lines.push((i + 1) + ". " + g.q.question);
      if (g.q.type === "matching") {
        g.q.leftItems.forEach(function (l, li) {
          lines.push("     " + l + "  ->  " + (g.q.correctAnswers[li] || "—"));
        });
      } else {
        g.q.correctIndices.forEach(function (ci) { lines.push("     correct: " + g.q.options[ci]); });
        if (g.isSkipped) lines.push("     yours:   (skipped)");
        else if (g.q.type === "single") lines.push("     yours:   " + g.q.options[g.resp]);
        else if (Array.isArray(g.resp)) lines.push("     yours:   " + g.resp.map(function (i2) { return g.q.options[i2]; }).join(", "));
      }
      lines.push("");
    });
    u.download(u.slugFile(R.bankKey) + "-report.txt", lines.join("\n"), "text/plain");
    App.ui.toast("Report downloaded.", "ok");
  }

  function renderReview() {
    const R = App.results;
    const list = document.getElementById("review-list");
    if (!list || !R) return;

    const items = R.graded.filter(function (g) {
      if (filter === "incorrect") return !g.isCorrect && !g.isSkipped;
      if (filter === "skipped") return g.isSkipped;
      if (filter === "flagged") return g.flagged;
      return true;
    });

    document.getElementById("rev-count").textContent = items.length + " of " + R.total + " shown";

    if (!items.length) {
      list.innerHTML = App.ui.empty({ icon: "check", title: "Nothing to show", desc: "No questions match this filter — great sign." });
      return;
    }

    list.innerHTML = items.map(function (g, i) { return reviewCard(g, i); }).join("");
    list.querySelectorAll("[data-explain]").forEach(function (btn) {
      btn.onclick = function () { App.ui.explainModal(items[parseInt(btn.dataset.explain, 10)].q); };
    });
  }

  function reviewCard(g, i) {
    const u = App.u;
    const q = g.q;
    const statusCls = g.isCorrect ? "chip-ok" : g.isSkipped ? "chip-mut" : "chip-bad";
    const statusTxt = g.isCorrect ? "Correct" : g.isSkipped ? "Skipped" : "Incorrect";
    const body = App.examShared.answerReviewHtml(q, g.resp);
    const media = App.ui.media(q);

    return (
      '<article class="card qcard rise" style="animation-delay:' + Math.min(i * 0.03, 0.35) + 's">' +
      '<div class="qcard-head"><span class="qcard-num">#' + (i + 1) + "</span>" +
      App.ui.typeChip(q.type) +
      (g.flagged ? '<span class="chip chip-warn">' + App.icon("flag", 10, 2.4) + "Flagged</span>" : "") +
      (g.ms ? '<span class="chip chip-mut">' + App.icon("clock", 10, 2.2) + u.fmtDuration(Math.round(g.ms / 1000)) + "</span>" : "") +
      (q.explanation ? '<button class="icon-btn" data-explain="' + i + '" title="Why?" aria-label="Show explanation">' + App.icon("lightbulb", 14) + "</button>" : "") +
      '<div class="spacer"><span class="chip ' + statusCls + '">' + statusTxt + "</span></div></div>" +
      '<div class="qcard-body"><div class="qcard-q">' + u.esc(q.question) + "</div>" + media + body + "</div></article>"
    );
  }

  App.views.results = View;
})();
