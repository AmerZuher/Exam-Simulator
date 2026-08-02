/* ExamPro — central store: state, persistence, migration, stats */
window.App = window.App || {};

(function () {
  const KEYS = {
    banks: "exampro_banks_v2",
    history: "exampro_history_v1",
    mastered: "exampro_mastered_v1",
    settings: "exampro_settings_v1",
    session: "exampro_session_v1",
    srs: "exampro_srs_v1",
    perf: "exampro_perf_v1",
    activity: "exampro_activity_v1",
    legacyBanks: "custom_exams_db"
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("store: failed reading", key, e);
      return fallback;
    }
  }

  function writeJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.warn("store: failed writing", key, e);
      if (App.ui && App.ui.toast) App.ui.toast("Storage is full — could not save.", "err");
      return false;
    }
  }

  const Store = {
    state: {
      banks: {},      // name -> { name, createdAt, questions: [] }
      history: {},    // name -> [{ ts, pct, correct, total, seconds, passed }]
      mastered: {},   // name -> { qid: true }
settings: { theme: "light", accent: "indigo", sidebarCollapsed: false, dailyGoal: 20 },
    session: null,   // in-progress exam snapshot
    dueDates: {},    // legacy v1 schedule — migrated into `srs` on load
    srs: {},         // name -> { qid: { ease, interval, reps, lapses, due, last, grade } }
    perf: {},        // name -> { qid: { seen, correct, streak, worst, ms, last } }
    activity: {}     // "YYYY-MM-DD" -> { reviews, answered, correct, seconds, attempts }
    },

    load: function () {
      this.state.banks = readJSON(KEYS.banks, null) || this.migrateLegacy() || {};
      this.state.history = readJSON(KEYS.history, {});
      this.state.mastered = readJSON(KEYS.mastered, {});
      const s = readJSON(KEYS.settings, null);
      if (s) this.state.settings = Object.assign(this.state.settings, s);
      this.state.session = readJSON(KEYS.session, null);
      this.state.dueDates = readJSON("exampro_duedates_v1", {});
      this.state.srs = readJSON(KEYS.srs, {});
      this.state.perf = readJSON(KEYS.perf, {});
      this.state.activity = readJSON(KEYS.activity, {});
      if (App.srs) App.srs.migrate();
    },

    /* Migrate banks saved by the legacy single-file app (custom_exams_db: name -> [questions]) */
    migrateLegacy: function () {
      const legacy = readJSON(KEYS.legacyBanks, null);
      if (!legacy || typeof legacy !== "object") return null;
      const out = {};
      Object.keys(legacy).forEach(function (name) {
        const qs = Array.isArray(legacy[name]) ? legacy[name] : [];
        if (qs.length) out[name] = { name: name, createdAt: Date.now(), questions: qs };
      });
      if (Object.keys(out).length) {
        writeJSON(KEYS.banks, out);
        console.info("store: migrated", Object.keys(out).length, "legacy bank(s)");
      }
      return out;
    },

    saveBanks: function () { writeJSON(KEYS.banks, this.state.banks); },
    saveHistory: function () { writeJSON(KEYS.history, this.state.history); },
    saveMastered: function () { writeJSON(KEYS.mastered, this.state.mastered); },
    saveSettings: function () { writeJSON(KEYS.settings, this.state.settings); },
    saveSession: function () { writeJSON(KEYS.session, this.state.session); },
    clearSession: function () { this.state.session = null; try { localStorage.removeItem(KEYS.session); } catch (e) {} },
    saveDueDates: function () { writeJSON("exampro_duedates_v1", this.state.dueDates); },
    saveSrs: function () { writeJSON(KEYS.srs, this.state.srs); },
    savePerf: function () { writeJSON(KEYS.perf, this.state.perf); },
    saveActivity: function () { writeJSON(KEYS.activity, this.state.activity); },

    /* ---- banks ---- */
    bankNames: function () { return Object.keys(this.state.banks); },
    getBank: function (name) { return this.state.banks[name] || null; },

    /* ---- per-bank appearance (icon + colour tone, or a custom logo image) ---- */
    bankIcon: function (name) {
      const b = this.state.banks[name];
      return (b && b.icon) || "grad";
    },
    bankTone: function (name) {
      const b = this.state.banks[name];
      return (b && b.tone) || "acc";
    },
    bankLogo: function (name) {
      const b = this.state.banks[name];
      return (b && b.logo) || null;
    },
    /* A logo image and a glyph icon are mutually exclusive (like the app's
       own branding) — passing `logo` clears the icon choice and vice versa,
       so bankBadge always has one unambiguous thing to render. */
    setBankLook: function (name, icon, tone, logo) {
      const b = this.state.banks[name];
      if (!b) return false;
      if (logo) { b.logo = logo; delete b.icon; }
      else if (icon) { b.icon = icon; delete b.logo; }
      if (tone) b.tone = tone;
      this.saveBanks();
      return true;
    },

    addBank: function (name, questions) {
      let final = name;
      let i = 2;
      while (this.state.banks[final]) { final = name + " (" + i + ")"; i++; }
      this.state.banks[final] = { name: final, createdAt: Date.now(), questions: questions };
      this.saveBanks();
      return final;
    },

    appendToBank: function (name, questions) {
      const bank = this.state.banks[name];
      if (!bank) return 0;
      const offset = bank.questions.length;
      questions.forEach(function (q, i) { q.id = offset + i + 1; });
      bank.questions = bank.questions.concat(questions);
      this.saveBanks();
      return offset;
    },

    deleteBank: function (name) {
      delete this.state.banks[name];
      delete this.state.history[name];
      delete this.state.mastered[name];
      delete this.state.srs[name];
      delete this.state.perf[name];
      this.saveBanks(); this.saveHistory(); this.saveMastered(); this.saveSrs(); this.savePerf();
      if (this.state.session && this.state.session.bankKey === name) this.clearSession();
    },

    renameBank: function (oldName, newName) {
      newName = (newName || "").trim();
      if (!newName || newName === oldName) return oldName;
      if (this.state.banks[newName]) return null; // name taken
      const bank = this.state.banks[oldName];
      if (!bank) return null;
      bank.name = newName;
      this.state.banks[newName] = bank;
      delete this.state.banks[oldName];
      if (this.state.history[oldName]) { this.state.history[newName] = this.state.history[oldName]; delete this.state.history[oldName]; }
      if (this.state.mastered[oldName]) { this.state.mastered[newName] = this.state.mastered[oldName]; delete this.state.mastered[oldName]; }
      if (this.state.srs[oldName]) { this.state.srs[newName] = this.state.srs[oldName]; delete this.state.srs[oldName]; }
      if (this.state.perf[oldName]) { this.state.perf[newName] = this.state.perf[oldName]; delete this.state.perf[oldName]; }
      if (this.state.session && this.state.session.bankKey === oldName) { this.state.session.bankKey = newName; this.saveSession(); }
      this.saveBanks(); this.saveHistory(); this.saveMastered(); this.saveSrs(); this.savePerf();
      return newName;
    },

    /* ---- history ---- */
    recordAttempt: function (name, attempt) {
      if (!this.state.history[name]) this.state.history[name] = [];
      this.state.history[name].push(attempt);
      if (this.state.history[name].length > 40) this.state.history[name] = this.state.history[name].slice(-40);
      this.saveHistory();
    },

    /* ---- mastered ---- */
    isMastered: function (name, qid) {
      return !!(this.state.mastered[name] && this.state.mastered[name][qid]);
    },
    toggleMastered: function (name, qid) {
      if (!this.state.mastered[name]) this.state.mastered[name] = {};
      const m = this.state.mastered[name];
      if (m[qid]) delete m[qid]; else m[qid] = true;
      this.saveMastered();
      return !!m[qid];
    },
    masteredCount: function (name) {
      return this.state.mastered[name] ? Object.keys(this.state.mastered[name]).length : 0;
    },
    resetMastered: function (name) {
      delete this.state.mastered[name];
      this.saveMastered();
    },

    /* ---- spaced repetition (thin delegates onto App.srs) ---- */
    getDueDate: function (name, qid) { return App.srs.card(name, qid).due; },
    isDueForReview: function (name, qid) { return App.srs.isDue(name, qid); },
    recordReview: function (name, qid, correct) { return App.srs.grade(name, qid, correct ? 2 : 0).interval; },
    dueCount: function (name) { return App.srs.dueCount(name); },

    /* ---- derived stats ---- */
    bankStats: function (name) {
      const bank = this.state.banks[name];
      if (!bank) return null;
      const types = { single: 0, multiple: 0, matching: 0 };
      bank.questions.forEach(function (q) { if (types[q.type] != null) types[q.type]++; });
      const hist = this.state.history[name] || [];
      const best = hist.reduce(function (m, a) { return Math.max(m, a.pct); }, 0);
      const last = hist.length ? hist[hist.length - 1] : null;
      return {
        count: bank.questions.length,
        types: types,
        attempts: hist.length,
        best: best,
        last: last,
        history: hist,
        mastered: this.masteredCount(name),
        due: App.srs.dueCount(name),
        retention: App.srs.retention(name)
      };
    },

    globalStats: function () {
      const names = this.bankNames();
      let questions = 0, attempts = 0, sum = 0, mastered = 0, due = 0, seconds = 0;
      const self = this;
      names.forEach(function (n) {
        const b = self.state.banks[n];
        questions += b.questions.length;
        const h = self.state.history[n] || [];
        attempts += h.length;
        h.forEach(function (a) { sum += a.pct; seconds += a.seconds || 0; });
        mastered += self.masteredCount(n);
        due += App.srs.dueCount(n);
      });
      return {
        banks: names.length,
        questions: questions,
        attempts: attempts,
        avg: attempts ? Math.round(sum / attempts) : 0,
        mastered: mastered,
        due: due,
        seconds: seconds,
        streak: App.srs.streak()
      };
    },

    /* ---- settings ---- */
    setSetting: function (k, v) { this.state.settings[k] = v; this.saveSettings(); }
  };

  App.store = Store;
})();
