/* ExamPro — mock "Sign in with Google" gate.
 *
 * There's no backend here, so this never talks to Google — it's a believable
 * stand-in (clearly labelled Beta) that gives the app a real front door:
 * shown on first launch and again after Sign out (Settings → User Profile),
 * and lets the demo "remember" whoever last signed in for a one-tap return.
 * Everything is stored via App.store's `settings.account` slot.
 */
window.App = window.App || {};

(function () {
  const Auth = {};

  /* two canned identities so the account chooser has something to pick
     between, plus "Use another account" for a custom name/email */
  const MOCK_ACCOUNTS = [
    { name: "Jordan Rivera", email: "jordan.rivera@gmail.com", initials: "JR", color: "#4285f4", isMock: true },
    { name: "Sam Whitfield", email: "sam.whitfield@gmail.com", initials: "SW", color: "#ea4335", isMock: true }
  ];

  const GOOGLE_G =
    '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">' +
    '<path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>' +
    '<path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>' +
    '<path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5c3.2 6.5 9.9 10.9 17.8 10.9z"/>' +
    '<path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C40.7 35.9 44 30.4 44 24c0-1.3-.1-2.6-.4-3.9z"/>' +
    '</svg>';

  function esc(s) { return App.u.esc(s); }

  function initialsOf(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  /* deterministic colour so the same typed-in name always gets the same
     avatar tint across a session */
  function colorFor(name) {
    let h = 0;
    const s = String(name || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return "hsl(" + h + ",62%,46%)";
  }

  /* Account avatar — used in the gate, the picker and Settings. The two
     canned "other people" in the picker get a colour-initials circle, same
     as a real Google account chooser would show; but the account that's
     actually you (continuing as, or typed in via "Use another account")
     reuses your own ExamPro profile picture when you've set one, rather
     than a mismatched generic circle next to your real photo. */
  Auth.avatarHtml = function (acc, size) {
    size = size || 26;
    const photo = !acc.isMock && App.branding.logoData();
    if (photo) {
      return '<span class="gbtn-avatar has-img" style="width:' + size + 'px;height:' + size + 'px">' +
        '<img src="' + esc(photo) + '" alt="" draggable="false"></span>';
    }
    return '<span class="gbtn-avatar" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.42) +
      'px;background:' + esc(acc.color || colorFor(acc.name)) + '">' + esc(acc.initials || initialsOf(acc.name)) + "</span>";
  };

  Auth.isSignedIn = function () {
    const acc = App.store.getAccount();
    return !!(acc && acc.signedIn);
  };

  /* ---------------- gate shell ----------------
     A genuine full page, not a dialog floating over a visible/blurred app —
     see .auth-gate in app.css. A single bordered card, centred on the
     app's own themed background (deliberately close to Google's own
     account-chooser look otherwise). Only the inner .auth-card is
     repainted as the flow moves welcome -> picker -> manual -> signing-in. */

  function paint(html) {
    const card = document.querySelector("#auth-gate .auth-card");
    if (card) card.innerHTML = html;
    return card;
  }

  Auth.showGate = function () {
    if (document.getElementById("auth-gate")) { renderWelcome(); return; }
    const veil = document.createElement("div");
    veil.className = "auth-gate";
    veil.id = "auth-gate";
    veil.innerHTML = '<div class="auth-page"><div class="auth-card"></div></div>';
    document.body.appendChild(veil);
    document.body.classList.add("no-scroll");
    renderWelcome();
  };

  Auth.hideGate = function () {
    const v = document.getElementById("auth-gate");
    if (v) v.remove();
    document.body.classList.remove("no-scroll");
  };

  /* ---------------- states ---------------- */

  function renderWelcome() {
    const last = App.store.getAccount(); // remembered even after sign-out
    const card = paint(
      '<div class="auth-mark brand' + (App.branding.logoData() ? " has-photo" : "") + '">' + App.branding.markHtml(30) + "</div>" +
      '<h1 class="auth-title">Welcome to ' + esc(App.branding.name()) + "</h1>" +
      '<p class="auth-sub">Sign in to keep your progress on this device — banks, scores and review streaks all stay local.</p>' +
      (last
        ? '<button type="button" class="google-btn" id="auth-continue-last">' +
          Auth.avatarHtml(last, 28) +
          '<span class="gbtn-text"><span class="gbtn-line1">Continue as ' + esc(last.name) + '</span>' +
          '<span class="gbtn-line2">' + esc(last.email) + "</span></span></button>" +
          '<button type="button" class="auth-back" id="auth-other" style="justify-content:center;display:flex;width:100%;margin:16px 0 0">Use another account</button>'
        : '<button type="button" class="google-btn" id="auth-google">' + GOOGLE_G +
          '<span class="gbtn-text"><span class="gbtn-line1">Continue with Google</span></span>' +
          '<span class="beta-badge">Beta</span></button>') +
      '<p class="auth-fine">Mock sign-in for this demo — no real Google account is contacted and nothing leaves your browser.</p>'
    );
    const contLast = card.querySelector("#auth-continue-last");
    if (contLast) contLast.onclick = function () { signingIn(last); };
    const other = card.querySelector("#auth-other");
    if (other) other.onclick = renderPicker;
    const google = card.querySelector("#auth-google");
    if (google) google.onclick = renderPicker;
  }

  function renderPicker() {
    const rows = MOCK_ACCOUNTS.map(function (a) {
      return '<button type="button" class="gacc-row" data-email="' + esc(a.email) + '">' +
        Auth.avatarHtml(a, 30) +
        '<span class="gacc-body"><span class="gacc-name">' + esc(a.name) + '</span>' +
        '<span class="gacc-email">' + esc(a.email) + "</span></span>" +
        App.icon("chevR", 14) + "</button>";
    }).join("");

    const card = paint(
      '<button type="button" class="auth-back" id="auth-back">' + App.icon("chevL", 13, 2.4) + "Back</button>" +
      '<div class="auth-mark">' + GOOGLE_G + "</div>" +
      '<h1 class="auth-title">Choose an account</h1>' +
      '<p class="auth-sub">to continue to ' + esc(App.branding.name()) + "</p>" +
      '<div class="gacc-list">' + rows +
      '<button type="button" class="gacc-row" id="gacc-other">' +
      '<span class="gbtn-avatar gbtn-avatar-generic">' + App.icon("user", 14) + "</span>" +
      '<span class="gacc-body"><span class="gacc-name">Use another account</span></span>' +
      App.icon("chevR", 14) + "</button></div>" +
      '<p class="auth-fine">Mock sign-in for this demo — no real Google account is contacted.</p>'
    );
    card.querySelector("#auth-back").onclick = renderWelcome;
    card.querySelectorAll(".gacc-row[data-email]").forEach(function (btn) {
      btn.onclick = function () {
        const acc = MOCK_ACCOUNTS.filter(function (a) { return a.email === btn.dataset.email; })[0];
        signingIn(acc);
      };
    });
    card.querySelector("#gacc-other").onclick = renderManual;
  }

  function renderManual() {
    const card = paint(
      '<button type="button" class="auth-back" id="auth-back">' + App.icon("chevL", 13, 2.4) + "Back</button>" +
      '<div class="auth-mark">' + GOOGLE_G + "</div>" +
      '<h1 class="auth-title">Use another account</h1>' +
      '<p class="auth-sub">Still just a demo — this signs you in locally, nothing is verified.</p>' +
      "<label class='field-lbl' style='text-align:left'>Name</label>" +
      '<input class="input" id="gacc-name" maxlength="40" placeholder="Your name">' +
      "<label class='field-lbl' style='text-align:left;margin-top:12px'>Email</label>" +
      '<input class="input" id="gacc-email" maxlength="60" placeholder="you@gmail.com">' +
      '<button type="button" class="btn btn-primary" id="gacc-go" style="width:100%;margin-top:18px">Continue</button>'
    );
    card.querySelector("#auth-back").onclick = renderPicker;
    const nameIn = card.querySelector("#gacc-name");
    const emailIn = card.querySelector("#gacc-email");
    nameIn.focus();
    function submit() {
      const name = nameIn.value.trim();
      const email = emailIn.value.trim();
      if (!name) { App.ui.toast("Enter a name.", "err"); nameIn.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { App.ui.toast("Enter a valid email.", "err"); emailIn.focus(); return; }
      signingIn({ name: name, email: email, initials: initialsOf(name), color: colorFor(name) });
    }
    card.querySelector("#gacc-go").onclick = submit;
    emailIn.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  }

  function signingIn(acc) {
    paint(
      '<div class="auth-mark brand' + (App.branding.logoData() ? " has-photo" : "") + '">' + App.branding.markHtml(30) + "</div>" +
      '<div class="auth-spinner"></div>' +
      '<p class="auth-sub" style="margin-bottom:0">Signing in as ' + esc(acc.name) + "…</p>"
    );
    setTimeout(function () {
      App.store.signIn(acc);
      Auth.hideGate();
      App.ui.toast("Signed in as " + acc.name + ".", "ok");
      if (App.router && App.router.currentName) App.main.renderSidebar(App.router.currentName);
    }, 700);
  }

  /* ---------------- sign out (called from Settings → User Profile) ---------------- */
  Auth.signOut = function () {
    App.store.signOut();
    Auth.showGate();
  };

  App.auth = Auth;
})();
