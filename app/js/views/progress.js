/* ExamPro — Progress: what the study data actually says.
 *
 * Reads history (attempts), srs (schedule), perf (per-question accuracy) and
 * activity (daily log) and turns them into: a score trend, a study heatmap,
 * upcoming review load, accuracy by question type, and a weak-spot list that
 * you can launch a drill from.
 */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Progress", sub: "Trends, retention and weak spots" };

  let scope = "all";     // bank name, or "all"

  View.render = function (root) {
    const u = App.u, store = App.store, srs = App.srs;
    const names = store.bankNames();

    if (!names.length) {
      root.innerHTML = '<div class="view">' + App.ui.empty({
        icon: "chart", title: "No data yet",
        desc: "Import a bank and take an exam or a review session — this page fills itself in from there.",
        actionsHtml: '<button class="btn btn-primary" onclick="App.router.go(\'#/import\')">Import a bank</button>'
      }) + "</div>";
      return;
    }
    if (scope !== "all" && names.indexOf(scope) === -1) scope = "all";

    const g = store.globalStats();
    const attempts = collectAttempts(scope);
    const activity = srs.heatmap(182);
    const totals = activity.reduce(function (a, d) {
      a.answered += d.answered; a.seconds += d.seconds; a.days += d.answered ? 1 : 0; return a;
    }, { answered: 0, seconds: 0, days: 0 });
    const retention = scopeRetention(scope);
    const best = attempts.reduce(function (m, a) { return Math.max(m, a.pct); }, 0);
    const trend = trendDelta(attempts);

    root.innerHTML =
      '<div class="view">' +

      /* ---- filter row: one row, above everything it scopes ---- */
      '<div class="prog-filter rise">' +
      '<span class="pf-lbl">Showing</span>' +
      '<select class="select" id="prog-scope" style="max-width:280px">' +
      '<option value="all"' + (scope === "all" ? " selected" : "") + ">All banks</option>" +
      names.map(function (n) {
        return '<option value="' + u.esc(n) + '"' + (scope === n ? " selected" : "") + ">" + u.esc(n) + "</option>";
      }).join("") + "</select>" +
      '<div class="pf-spacer"></div>' +
      (g.due ? '<button class="btn btn-primary btn-sm" data-act="review">' + App.icon("cards", 14) + g.due + " due — review now</button>" : "") +
      "</div>" +

      /* ---- headline tiles ---- */
      '<section class="stat-grid" style="margin-top:16px">' +
      tile("flame", g.streak, "Day streak", 0, "", g.streak ? "keep it alive" : "study today to start one") +
      tile("target", retention, "Retention", 1, "%", "scheduled 7+ days out") +
      tile("check", totals.answered, "Answered", 2, "", "in the last 6 months") +
      tile("clock", Math.round(totals.seconds / 60), "Minutes", 3, "", totals.days + " active day" + (totals.days === 1 ? "" : "s")) +
      "</section>" +

      /* ---- trend + forecast ---- */
      '<div class="prog-row" style="margin-top:20px">' +
      '<section class="card card-pad rise chart-card">' +
      '<div class="chart-head"><div>' +
      "<h3>Score by attempt</h3>" +
      '<p class="chart-sub">' + (attempts.length
        ? attempts.length + " attempt" + (attempts.length === 1 ? "" : "s") + " · best " + best + "%" +
          (trend != null ? ' · <span class="' + (trend >= 0 ? "delta-up" : "delta-dn") + '">' + (trend >= 0 ? "▲ +" : "▼ ") + trend + " pts vs. your first five</span>" : "")
        : "No exam attempts recorded yet") + "</p></div>" +
      '<div class="chart-legend">' +
      '<span class="cl-item"><i class="cl-dot" style="background:var(--ok)"></i>passed</span>' +
      '<span class="cl-item"><i class="cl-dot" style="background:var(--bad)"></i>below threshold</span>' +
      "</div></div>" +
      '<div id="chart-trend" class="chart-host"></div>' +
      (attempts.length ? '<button class="linklike table-toggle" data-act="table">Show as table</button><div id="trend-table" class="table-wrap" hidden></div>' : "") +
      "</section>" +

      '<section class="card card-pad rise chart-card" style="animation-delay:.05s">' +
      '<div class="chart-head"><div><h3>Review forecast</h3>' +
      '<p class="chart-sub">Cards the scheduler will surface over the next two weeks</p></div></div>' +
      '<div id="chart-forecast" class="chart-host"></div>' +
      "</section>" +
      "</div>" +

      /* ---- heatmap ---- */
      '<section class="card card-pad rise chart-card" style="margin-top:18px">' +
      '<div class="chart-head"><div><h3>Study activity</h3>' +
      '<p class="chart-sub">' + totals.days + " active day" + (totals.days === 1 ? "" : "s") + " in the last 26 weeks · longest streak " + srs.bestStreak() + " day" + (srs.bestStreak() === 1 ? "" : "s") + "</p></div>" +
      '<div class="chart-legend heat-legend"><span>less</span>' +
      '<i class="heat-key lvl-0"></i><i class="heat-key lvl-1"></i><i class="heat-key lvl-2"></i><i class="heat-key lvl-3"></i><i class="heat-key lvl-4"></i>' +
      "<span>more</span></div></div>" +
      '<div id="chart-heat" class="chart-host heat-host"></div>' +
      "</section>" +

      /* ---- accuracy + weak spots ---- */
      '<div class="prog-row" style="margin-top:18px">' +
      '<section class="card card-pad rise chart-card">' +
      '<div class="chart-head"><div><h3>Accuracy by question type</h3>' +
      '<p class="chart-sub">Lifetime, across every answer you have given</p></div></div>' +
      typeAccuracyHtml(scope) +
      "</section>" +
      '<section class="card card-pad rise chart-card" style="animation-delay:.05s">' +
      '<div class="chart-head"><div><h3>Deck health</h3>' +
      '<p class="chart-sub">Mastery, retention and what is waiting for you</p></div></div>' +
      deckTableHtml(scope) +
      "</section>" +
      "</div>" +

      /* ---- weak spots ---- */
      weakSpotsHtml(scope) +
      "</div>";

    /* count-ups */
    root.querySelectorAll("[data-count]").forEach(function (e) {
      u.countUp(e, parseFloat(e.dataset.count), { suffix: e.dataset.suffix || "", duration: 800 });
    });

    /* charts */
    App.chart.line(document.getElementById("chart-trend"),
      attempts.map(function (a, i) {
        return {
          x: u.fmtDate(a.ts).replace(/, \d{4}$/, ""),
          y: a.pct,
          ok: a.passed,
          tipTitle: a.bank,
          rows: [
            { label: "correct", value: a.correct + "/" + a.total, color: "" },
            { label: "took", value: u.fmtDuration(a.seconds), color: "" }
          ]
        };
      }),
      { threshold: 70, thresholdLabel: "typical pass mark", valueLabel: "score", height: 200 });

    App.chart.columns(document.getElementById("chart-forecast"),
      srs.forecast(scope === "all" ? null : scope, 14).map(function (d, i) {
        const date = new Date(d.ts);
        return {
          label: i === 0 ? "today" : date.getDate(),
          value: d.count,
          today: i === 0,
          tipTitle: i === 0 ? "Due today" : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
        };
      }),
      { height: 168, unit: "cards due" });

    App.chart.heatmap(document.getElementById("chart-heat"), activity);

    wire(root.firstElementChild, attempts);
  };

  View.destroy = function () { if (App.chart) App.chart.hideTip(); };

  /* ---------------- data helpers ---------------- */

  function collectAttempts(sc) {
    const store = App.store;
    const out = [];
    (sc === "all" ? store.bankNames() : [sc]).forEach(function (n) {
      (store.state.history[n] || []).forEach(function (a) {
        out.push({ bank: n, ts: a.ts, pct: a.pct, correct: a.correct, total: a.total, seconds: a.seconds, passed: a.passed });
      });
    });
    return out.sort(function (a, b) { return a.ts - b.ts; });
  }

  /* Average of the most recent five minus the first five — "am I improving?" */
  function trendDelta(attempts) {
    if (attempts.length < 4) return null;
    const avg = function (arr) { return arr.reduce(function (s, a) { return s + a.pct; }, 0) / arr.length; };
    const first = attempts.slice(0, 5);
    const last = attempts.slice(-5);
    return Math.round(avg(last) - avg(first));
  }

  function scopeRetention(sc) {
    if (sc !== "all") return App.srs.retention(sc);
    const names = App.store.bankNames();
    if (!names.length) return 0;
    let q = 0, sum = 0;
    names.forEach(function (n) {
      const c = App.store.getBank(n).questions.length;
      q += c;
      sum += App.srs.retention(n) * c;
    });
    return q ? Math.round(sum / q) : 0;
  }

  function tile(icon, val, label, i, suffix, sub) {
    return (
      '<div class="stat-tile rise" style="animation-delay:' + (0.04 + i * 0.04) + 's">' +
      '<div class="stat-ico">' + App.icon(icon, 17) + "</div>" +
      '<div class="stat-num" data-count="' + val + '" data-suffix="' + (suffix || "") + '">0</div>' +
      '<div class="stat-lbl">' + label + "</div>" +
      (sub ? '<div class="stat-sub">' + App.u.esc(sub) + "</div>" : "") +
      "</div>"
    );
  }

  /* Horizontal bars, every one directly labelled — which is also the relief
     required for the amber's sub-3:1 contrast in light mode. */
  function typeAccuracyHtml(sc) {
    const store = App.store, srs = App.srs;
    const names = sc === "all" ? store.bankNames() : [sc];
    const agg = { single: { c: 0, t: 0 }, multiple: { c: 0, t: 0 }, matching: { c: 0, t: 0 } };
    names.forEach(function (n) {
      const bank = store.getBank(n);
      if (!bank) return;
      bank.questions.forEach(function (q) {
        const p = srs.stat(n, q.id);
        if (!p.seen || !agg[q.type]) return;
        agg[q.type].c += p.correct;
        agg[q.type].t += p.seen;
      });
    });

    const colors = { single: "var(--acc)", multiple: "var(--warn)", matching: "var(--teal)" };
    const rows = Object.keys(agg).filter(function (t) { return agg[t].t; }).map(function (t) {
      const pct = Math.round((agg[t].c / agg[t].t) * 100);
      return '<div class="acc-bar-row"><span class="ab-l">' + App.ui.typeLabel(t) + "</span>" +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + "%;background:" + colors[t] + '"></div></div>' +
        '<span class="ab-n">' + pct + "% · " + agg[t].c + "/" + agg[t].t + "</span></div>";
    }).join("");

    if (!rows) {
      return '<p class="chart-empty">Answer some questions and the split by type shows up here.</p>';
    }
    return '<div class="acc-bars" style="margin-top:6px">' + rows + "</div>";
  }

  function deckTableHtml(sc) {
    const store = App.store, u = App.u;
    const names = sc === "all" ? store.bankNames() : [sc];
    const rows = names.map(function (n) {
      const st = store.bankStats(n);
      const mastery = st.count ? Math.round((st.mastered / st.count) * 100) : 0;
      return (
        '<tr><td class="dt-name" title="' + u.esc(n) + '">' +
        '<span class="dt-badge">' + App.ui.bankBadge(n, 13, "xs") + "</span>" + u.esc(n) + "</td>" +
        '<td class="mono">' + st.count + "</td>" +
        '<td><div class="micro-bar"><i style="width:' + mastery + '%"></i></div><span class="mono micro-n">' + mastery + "%</span></td>" +
        '<td><div class="micro-bar retain"><i style="width:' + st.retention + '%"></i></div><span class="mono micro-n">' + st.retention + "%</span></td>" +
        '<td class="mono">' + (st.attempts ? st.best + "%" : "—") + "</td>" +
        '<td>' + (st.due ? '<span class="due-badge">' + st.due + "</span>" : '<span class="mono" style="color:var(--faint)">0</span>') + "</td></tr>"
      );
    }).join("");

    return (
      '<div class="table-wrap" style="margin-top:4px"><table class="data-table">' +
      "<thead><tr><th>Bank</th><th>Qs</th><th>Mastery</th><th>Retention</th><th>Best</th><th>Due</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>"
    );
  }

  function weakSpotsHtml(sc) {
    const u = App.u;
    const weak = App.srs.weakest(sc === "all" ? null : sc, 8);
    if (!weak.length) {
      return '<div class="sec-head" style="margin-top:24px"><h3>Weak spots</h3></div>' +
        App.ui.empty({
          icon: "target", title: "Nothing flagged as weak",
          desc: "Once you have answered questions more than once, the ones you keep missing are collected here with a one-click drill."
        });
    }

    const rows = weak.map(function (w, i) {
      const pct = Math.round(w.acc * 100);
      const band = w.score > 0.66 ? "sev-high" : w.score > 0.4 ? "sev-mid" : "sev-low";
      return (
        '<div class="weak-row rise" style="animation-delay:' + Math.min(i * 0.03, 0.3) + 's">' +
        '<div class="weak-score ' + band + '">' + pct + "%</div>" +
        '<div class="weak-body"><div class="weak-q">' + u.esc(w.q.question) + "</div>" +
        '<div class="weak-meta">' + u.esc(w.bank) + " · " + App.ui.typeLabel(w.q.type) +
        " · seen " + w.stat.seen + "× · " +
        (w.stat.streak < 0 ? "missed the last " + Math.abs(w.stat.streak) : "streak " + w.stat.streak) +
        (w.stat.ms ? " · ~" + Math.round(w.stat.ms / 1000) + "s each" : "") + "</div></div>" +
        '<button class="btn btn-ghost btn-sm" data-drill="' + u.esc(w.bank) + '">' + App.icon("bolt", 13) + "Drill</button>" +
        "</div>"
      );
    }).join("");

    return (
      '<div class="sec-head" style="margin-top:24px"><h3>Weak spots</h3>' +
      '<span class="count-badge">' + weak.length + " flagged</span>" +
      '<div class="sec-actions"><button class="btn btn-primary btn-sm" data-act="drill-all">' + App.icon("bolt", 14) + "Drill all weak spots</button></div></div>" +
      '<section class="weak-list">' + rows + "</section>"
    );
  }

  /* ---------------- wiring ---------------- */

  function wire(wrap, attempts) {
    const sel = wrap.querySelector("#prog-scope");
    if (sel) sel.onchange = function () {
      scope = sel.value;
      View.render(document.getElementById("view"));
    };

    App.u.on(wrap, "click", "[data-act]", function (e, el) {
      const a = el.dataset.act;
      if (a === "review") {
        const target = scope === "all" ? firstDueBank() : scope;
        if (target) App.views.review.start(target, {});
        else App.ui.toast("Nothing is due right now.", "info");
      } else if (a === "drill-all") {
        drill(scope);
      } else if (a === "table") {
        const box = document.getElementById("trend-table");
        if (!box) return;
        const opening = box.hasAttribute("hidden");
        if (opening && !box.innerHTML) box.innerHTML = attemptTable(attempts);
        box.toggleAttribute("hidden");
        el.textContent = opening ? "Hide table" : "Show as table";
      }
    });

    App.u.on(wrap, "click", "[data-drill]", function (e, el) { drill(el.dataset.drill); });
  }

  function attemptTable(attempts) {
    const u = App.u;
    return '<table class="data-table"><thead><tr><th>#</th><th>Date</th><th>Bank</th><th>Score</th><th>Correct</th><th>Time</th></tr></thead><tbody>' +
      attempts.map(function (a, i) {
        return "<tr><td class='mono'>" + (i + 1) + "</td><td>" + u.fmtDate(a.ts) + "</td><td class='dt-name'>" + u.esc(a.bank) + "</td>" +
          "<td class='mono' style='color:" + (a.passed ? "var(--ok)" : "var(--bad)") + "'>" + a.pct + "%</td>" +
          "<td class='mono'>" + a.correct + "/" + a.total + "</td><td class='mono'>" + u.fmtDuration(a.seconds) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function firstDueBank() {
    const names = App.store.bankNames();
    for (let i = 0; i < names.length; i++) if (App.srs.dueCount(names[i])) return names[i];
    return names[0] || null;
  }

  /* Launch a weak-spot drill: an exam built only from the shaky questions. */
  function drill(bankScope) {
    if (bankScope && bankScope !== "all") {
      const ids = App.srs.weakIds(bankScope, 25);
      if (!ids.length) { App.ui.toast("No weak questions in this bank yet.", "info"); return; }
      App.views.exam.launchFromIds(bankScope, ids, { passPct: 80, shuffleQuestions: true, label: "Weak spots" });
      return;
    }
    /* all banks: take the worst offenders wherever they live */
    const weak = App.srs.weakest(null, 25);
    if (!weak.length) { App.ui.toast("No weak questions recorded yet.", "info"); return; }
    App.views.exam.launchMixed(weak.map(function (w) { return { bank: w.bank, id: w.q.id }; }),
      { passPct: 80, label: "Weak spots — all banks" });
  }

  App.views.progress = View;
})();
