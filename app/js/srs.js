/* ExamPro — spaced repetition (SM-2) + per-question performance analytics
 *
 * Three data sets, all keyed by bank name then question id:
 *   srs[bank][qid]  -> { ease, interval, reps, lapses, due, last, grade }
 *   perf[bank][qid] -> { seen, correct, streak, worst, ms, last }
 *   activity["YYYY-MM-DD"] -> { reviews, answered, correct, seconds, attempts }
 *
 * The scheduler is a lightly tuned SM-2: four grades, ease factor clamped to
 * [1.3, 3.0], and a "learning" phase for the first two successful reps so a
 * brand-new question is not thrown 6 days into the future on its first pass.
 */
window.App = window.App || {};

(function () {
  const S = {};

  /* 0 = again, 1 = hard, 2 = good, 3 = easy */
  S.GRADES = [
    { key: "again", label: "Again", hint: "Blank — show it soon", color: "var(--bad)" },
    { key: "hard", label: "Hard", hint: "Recalled with effort", color: "var(--warn)" },
    { key: "good", label: "Good", hint: "Recalled correctly", color: "var(--acc)" },
    { key: "easy", label: "Easy", hint: "Instant — push it out", color: "var(--ok)" }
  ];

  const DAY = 86400000;
  const MIN_EASE = 1.3;
  const MAX_EASE = 3.0;
  const MAX_INTERVAL = 365;

  function bucket(map, bank) {
    if (!map[bank]) map[bank] = {};
    return map[bank];
  }

  /* ---------------- cards ---------------- */

  S.newCard = function () {
    return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0, last: 0, grade: -1 };
  };

  S.card = function (bank, qid) {
    const b = App.store.state.srs[bank];
    const c = b && b[qid];
    if (!c) return S.newCard();
    /* defensive: fill gaps left by older payloads */
    return Object.assign(S.newCard(), c);
  };

  /* Apply a grade and reschedule. Returns the updated card. */
  S.grade = function (bank, qid, g) {
    const store = App.store;
    const cards = bucket(store.state.srs, bank);
    const c = S.card(bank, qid);
    const now = Date.now();

    if (g === 0) {
      c.lapses++;
      c.reps = 0;
      c.interval = 0;
      c.ease = Math.max(MIN_EASE, c.ease - 0.2);
      c.due = now; /* stays in today's queue */
    } else {
      if (g === 1) c.ease = Math.max(MIN_EASE, c.ease - 0.15);
      else if (g === 3) c.ease = Math.min(MAX_EASE, c.ease + 0.15);

      if (c.reps === 0) c.interval = g === 1 ? 1 : g === 3 ? 3 : 1;
      else if (c.reps === 1) c.interval = g === 1 ? 2 : g === 3 ? 6 : 3;
      else {
        const mult = g === 1 ? 1.2 : g === 3 ? c.ease * 1.3 : c.ease;
        c.interval = Math.max(1, Math.round(c.interval * mult));
      }
      c.interval = Math.min(MAX_INTERVAL, c.interval);
      c.reps++;
      c.due = now + c.interval * DAY;
    }

    c.last = now;
    c.grade = g;
    cards[qid] = c;
    store.saveSrs();
    return c;
  };

  /* What would grading with `g` schedule? Pure — used for the button labels. */
  S.preview = function (bank, qid, g) {
    const c = S.card(bank, qid);
    if (g === 0) return 0;
    let ease = c.ease;
    if (g === 1) ease = Math.max(MIN_EASE, ease - 0.15);
    else if (g === 3) ease = Math.min(MAX_EASE, ease + 0.15);
    let iv;
    if (c.reps === 0) iv = g === 1 ? 1 : g === 3 ? 3 : 1;
    else if (c.reps === 1) iv = g === 1 ? 2 : g === 3 ? 6 : 3;
    else iv = Math.max(1, Math.round(c.interval * (g === 1 ? 1.2 : g === 3 ? ease * 1.3 : ease)));
    return Math.min(MAX_INTERVAL, iv);
  };

  /* "0 → now", "1 → 1 day", "30 → 1 mo" */
  S.fmtInterval = function (days) {
    if (!days) return "now";
    if (days === 1) return "1 day";
    if (days < 30) return days + " days";
    if (days < 365) return Math.round(days / 30) + " mo";
    return (days / 365).toFixed(1) + " yr";
  };

  /* Grade derived from an exam answer (no self-report available). */
  S.gradeFromExam = function (bank, qid, correct, wasFast) {
    return S.grade(bank, qid, correct ? (wasFast ? 3 : 2) : 0);
  };

  S.isDue = function (bank, qid) {
    const c = App.store.state.srs[bank];
    if (!c || !c[qid]) return true;          /* never studied ⇒ due */
    return (c[qid].due || 0) <= Date.now();
  };

  S.isNew = function (bank, qid) {
    const c = App.store.state.srs[bank];
    return !c || !c[qid] || !c[qid].reps;
  };

  /* Question ids due right now, hardest (lowest ease / most lapses) first. */
  S.dueIds = function (bank) {
    const b = App.store.getBank(bank);
    if (!b) return [];
    const now = Date.now();
    return b.questions
      .filter(function (q) {
        const c = App.store.state.srs[bank] && App.store.state.srs[bank][q.id];
        return !c || (c.due || 0) <= now;
      })
      .sort(function (a, z) {
        const ca = S.card(bank, a.id), cz = S.card(bank, z.id);
        return (ca.ease - cz.ease) || (cz.lapses - ca.lapses) || (a.id - z.id);
      })
      .map(function (q) { return q.id; });
  };

  S.dueCount = function (bank) { return S.dueIds(bank).length; };

  /* Counts split by learning stage — powers the review-mode header. */
  S.queueBreakdown = function (bank) {
    const b = App.store.getBank(bank);
    const out = { fresh: 0, learning: 0, review: 0, later: 0, total: 0 };
    if (!b) return out;
    const now = Date.now();
    b.questions.forEach(function (q) {
      const c = S.card(bank, q.id);
      out.total++;
      const due = (c.due || 0) <= now;
      if (!c.reps) out.fresh++;
      else if (!due) out.later++;
      else if (c.interval < 7) out.learning++;
      else out.review++;
    });
    return out;
  };

  /* How much of the bank is scheduled far enough out to count as retained. */
  S.retention = function (bank) {
    const b = App.store.getBank(bank);
    if (!b || !b.questions.length) return 0;
    let strong = 0;
    b.questions.forEach(function (q) {
      const c = S.card(bank, q.id);
      if (c.reps >= 2 && c.interval >= 7) strong++;
    });
    return Math.round((strong / b.questions.length) * 100);
  };

  /* Upcoming review load: [{ ts, day, count }] for the next `days` days. */
  S.forecast = function (bank, days) {
    days = days || 14;
    const out = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) out.push({ ts: start.getTime() + i * DAY, count: 0 });

    const banks = bank ? [bank] : App.store.bankNames();
    banks.forEach(function (name) {
      const b = App.store.getBank(name);
      if (!b) return;
      b.questions.forEach(function (q) {
        const c = S.card(name, q.id);
        const due = c.due || 0;
        const idx = due <= start.getTime() ? 0 : Math.floor((due - start.getTime()) / DAY);
        if (idx >= 0 && idx < days) out[idx].count++;
      });
    });
    return out;
  };

  S.resetBank = function (bank) {
    delete App.store.state.srs[bank];
    delete App.store.state.perf[bank];
    App.store.saveSrs();
    App.store.savePerf();
  };

  /* ---------------- per-question performance ---------------- */

  S.stat = function (bank, qid) {
    const b = App.store.state.perf[bank];
    const p = b && b[qid];
    return p ? Object.assign({ seen: 0, correct: 0, streak: 0, worst: 0, ms: 0, last: 0 }, p)
             : { seen: 0, correct: 0, streak: 0, worst: 0, ms: 0, last: 0 };
  };

  S.accuracy = function (bank, qid) {
    const p = S.stat(bank, qid);
    return p.seen ? p.correct / p.seen : null;
  };

  /* Record one answered question. `ms` is time spent on it (optional). */
  S.record = function (bank, qid, correct, ms) {
    const perf = bucket(App.store.state.perf, bank);
    const p = S.stat(bank, qid);
    p.seen++;
    if (correct) { p.correct++; p.streak = p.streak > 0 ? p.streak + 1 : 1; }
    else { p.correct += 0; p.streak = p.streak < 0 ? p.streak - 1 : -1; p.worst++; }
    if (ms && ms > 0 && ms < 15 * 60 * 1000) {
      p.ms = p.ms ? Math.round(p.ms * 0.6 + ms * 0.4) : ms;  /* smoothed average */
    }
    p.last = Date.now();
    perf[qid] = p;
    App.store.savePerf();
    return p;
  };

  /* Difficulty score in [0,1] — higher means "needs work".
     Blends miss rate, recent streak, lapses and SRS ease. */
  S.difficulty = function (bank, qid) {
    const p = S.stat(bank, qid);
    const c = S.card(bank, qid);
    if (!p.seen && !c.reps) return 0.5;                       /* unknown ⇒ middling */
    const missRate = p.seen ? 1 - p.correct / p.seen : 0.5;
    const easePart = 1 - (c.ease - MIN_EASE) / (MAX_EASE - MIN_EASE);
    const lapsePart = Math.min(1, c.lapses / 4);
    const streakPart = p.streak < 0 ? Math.min(1, -p.streak / 3) : 0;
    const d = missRate * 0.45 + easePart * 0.2 + lapsePart * 0.2 + streakPart * 0.15;
    return App.u.clamp(d, 0, 1);
  };

  /* Weakest questions across one bank (or all banks when `bank` is null). */
  S.weakest = function (bank, limit) {
    limit = limit || 10;
    const names = bank ? [bank] : App.store.bankNames();
    const rows = [];
    names.forEach(function (name) {
      const b = App.store.getBank(name);
      if (!b) return;
      b.questions.forEach(function (q) {
        const p = S.stat(name, q.id);
        if (!p.seen || p.correct >= p.seen) return;            /* needs at least one miss to count as "weak" */
        const acc = p.correct / p.seen;
        rows.push({ bank: name, q: q, stat: p, acc: acc, score: S.difficulty(name, q.id) });
      });
    });
    rows.sort(function (a, z) { return z.score - a.score || z.stat.seen - a.stat.seen; });
    return rows.slice(0, limit);
  };

  /* Ordered ids for a "drill my weak spots" session. */
  S.weakIds = function (bank, limit) {
    return S.weakest(bank, limit || 9999).map(function (r) { return r.q.id; });
  };

  /* ---------------- activity log & streaks ---------------- */

  S.dayKey = function (ts) {
    const d = new Date(ts == null ? Date.now() : ts);
    return d.getFullYear() + "-" + App.u.pad2(d.getMonth() + 1) + "-" + App.u.pad2(d.getDate());
  };

  S.logActivity = function (patch) {
    const log = App.store.state.activity;
    const k = S.dayKey();
    const day = log[k] || { reviews: 0, answered: 0, correct: 0, seconds: 0, attempts: 0 };
    Object.keys(patch).forEach(function (f) { day[f] = (day[f] || 0) + (patch[f] || 0); });
    log[k] = day;
    App.store.saveActivity();
  };

  S.dayStats = function (ts) {
    return App.store.state.activity[S.dayKey(ts)] || { reviews: 0, answered: 0, correct: 0, seconds: 0, attempts: 0 };
  };

  function isActive(d) { return d && (d.answered > 0 || d.reviews > 0); }

  /* Current streak counts back from today (or yesterday, if today is untouched). */
  S.streak = function () {
    const log = App.store.state.activity;
    let n = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!isActive(log[S.dayKey(cursor.getTime())])) cursor.setTime(cursor.getTime() - DAY);
    while (isActive(log[S.dayKey(cursor.getTime())])) {
      n++;
      cursor.setTime(cursor.getTime() - DAY);
    }
    return n;
  };

  S.bestStreak = function () {
    const keys = Object.keys(App.store.state.activity).filter(function (k) {
      return isActive(App.store.state.activity[k]);
    }).sort();
    let best = 0, run = 0, prev = null;
    keys.forEach(function (k) {
      const t = new Date(k + "T00:00:00").getTime();
      run = prev != null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
      prev = t;
      if (run > best) best = run;
    });
    return best;
  };

  /* Last `days` days as a flat array for the heatmap, oldest first. */
  S.heatmap = function (days) {
    days = days || 182;
    const out = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const ts = today.getTime() - i * DAY;
      const d = App.store.state.activity[S.dayKey(ts)];
      out.push({ ts: ts, answered: d ? d.answered : 0, reviews: d ? d.reviews : 0, seconds: d ? d.seconds : 0 });
    }
    return out;
  };

  /* ---------------- one-time migration from the v1 dueDates map ---------------- */
  S.migrate = function () {
    const legacy = App.store.state.dueDates;
    if (!legacy || !Object.keys(legacy).length) return;
    if (App.store.state.srs && Object.keys(App.store.state.srs).length) return;
    Object.keys(legacy).forEach(function (bank) {
      const src = legacy[bank] || {};
      const dst = bucket(App.store.state.srs, bank);
      Object.keys(src).forEach(function (k) {
        if (/_interval$/.test(k)) return;
        const qid = k;
        const interval = src[qid + "_interval"] || 0;
        dst[qid] = {
          ease: 2.5,
          interval: interval,
          reps: interval > 0 ? 1 : 0,
          lapses: 0,
          due: src[qid] || 0,
          last: 0,
          grade: -1
        };
      });
    });
    App.store.saveSrs();
    console.info("srs: migrated legacy review schedule");
  };

  App.srs = S;
})();
