/* ExamPro — shared exam-taking logic used by both Exam mode (exam.js) and
 * Practice Mode (practice.js): question pools, cloning, shuffling, grading,
 * and the "your answer vs. correct answer" review markup also reused by
 * results.js. Kept in one place so the two modes can never quietly diverge
 * on what counts as correct or how a pool is resolved.
 */
window.App = window.App || {};

(function () {
  const S = {};

  /* ---------------- question pools ----------------
     Each pool returns the ids to draw from, or null for "the whole bank". */
  S.POOLS = {
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

  S.poolCount = function (bankKey, pool) {
    const ids = S.POOLS[pool].ids(bankKey);
    return ids === null ? App.store.getBank(bankKey).questions.length : ids.length;
  };

  /* Resolve a pool + explicit id list into the ordered source questions for
     a bank, honoring the pool's own ordering when it returns one. */
  S.resolvePool = function (bankKey, pool) {
    const bank = App.store.getBank(bankKey);
    if (!bank) return [];
    const poolIds = S.POOLS[pool || "all"].ids(bankKey);
    if (poolIds === null) return bank.questions;
    const want = {}, order = {};
    poolIds.forEach(function (id, i) { want[id] = true; order[id] = i; });
    return bank.questions.filter(function (q) { return want[q.id]; })
      .sort(function (a, b) { return order[a.id] - order[b.id]; });
  };

  /* A session-local copy of a stored question — mutating the clone (option
     shuffling, etc.) never touches the saved bank. Carries `difficulty` /
     `explanation` through when present, so any mode built on top of this
     (Practice Mode's inline explanation, a future Exam-mode explanation
     modal) actually has the data to show. */
  S.cloneQuestion = function (q) {
    const out = {
      id: q.id, question: q.question, type: q.type,
      options: q.options.slice(), correctIndices: q.correctIndices.slice(),
      images: (q.images || []).slice(), audios: (q.audios || []).slice(), videos: (q.videos || []).slice(),
      leftItems: (q.leftItems || []).slice(), rightItems: (q.rightItems || []).slice(),
      correctAnswers: Object.assign({}, q.correctAnswers)
    };
    if (q.difficulty) out.difficulty = q.difficulty;
    if (q.explanation) {
      out.explanation = {};
      if (q.explanation.correct) out.explanation.correct = q.explanation.correct;
      if (q.explanation.incorrect && q.explanation.incorrect.length) out.explanation.incorrect = q.explanation.incorrect.slice();
    }
    return out;
  };

  S.shuffleQuestionOptions = function (q) {
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
  };

  S.resolveTimeLimit = function (v, count) {
    if (v === "pace") return count * 90;
    const n = parseInt(v, 10);
    return isNaN(n) || n <= 0 ? 0 : n;
  };

  /* Has this question been given a usable response yet — same "answered"
     definition everywhere (exam nav grid, submit-confirmation, Practice
     Mode's Check-answer gate). */
  S.isAnswered = function (q, resp) {
    return q.type === "matching"
      ? !!(resp && Object.keys(resp).some(function (k) { return resp[k]; }))
      : resp !== undefined && (!Array.isArray(resp) || resp.length > 0);
  };

  /* The one grading rule, by type — { isCorrect, isSkipped }. */
  S.gradeQuestion = function (q, resp) {
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
    return { isCorrect: isCorrect, isSkipped: isSkipped };
  };

  /* "Your answer vs. the correct answer" markup — the results page's review
     list and Practice Mode's per-question checked state render identically. */
  S.answerReviewHtml = function (q, resp) {
    const u = App.u;
    if (q.type === "matching") {
      return '<div class="match-pairs">' + q.leftItems.map(function (left, li) {
        const yours = resp && resp[li] ? resp[li] : "—";
        const expected = q.correctAnswers[li] || "—";
        const ok = yours === expected;
        return (
          '<div class="match-pair ' + (ok ? "is-ok" : "is-wrong") + '">' +
          '<div class="mp-l">' + u.esc(left) + (ok ? "" : '<div class="mp-expected">Expected: ' + u.esc(expected) + "</div>") + "</div>" +
          '<div class="mp-arrow">' + App.icon(ok ? "check" : "x", 15, 2.2) + "</div>" +
          '<div class="mp-r">' + u.esc(yours) + "</div>" +
          "</div>"
        );
      }).join("") + "</div>";
    }
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return '<div class="opt-list">' + q.options.map(function (opt, oi) {
      const wasChosen = q.type === "single" ? resp === oi : Array.isArray(resp) && resp.indexOf(oi) !== -1;
      const isAnswer = q.correctIndices.indexOf(oi) !== -1;
      let cls = "opt-row", tag = "", letter = letters[oi % 26];
      if (wasChosen && isAnswer) { cls += " is-correct"; tag = '<span class="opt-tag t-ok">Your answer</span>'; letter = App.icon("check", 12, 3); }
      else if (wasChosen && !isAnswer) { cls += " is-wrong"; tag = '<span class="opt-tag t-bad">Your pick</span>'; letter = App.icon("x", 12, 3); }
      else if (!wasChosen && isAnswer) { cls += " is-missed"; tag = '<span class="opt-tag t-acc">Correct answer</span>'; letter = App.icon("check", 12, 3); }
      return '<div class="' + cls + '"><span class="opt-letter">' + letter + "</span><span>" + u.esc(opt) + "</span>" + tag + "</div>";
    }).join("") + "</div>";
  };

  S.medianOf = function (arr) {
    if (!arr.length) return 0;
    const a = arr.slice().sort(function (x, y) { return x - y; });
    const mid = a.length >> 1;
    return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
  };

  App.examShared = S;
})();
