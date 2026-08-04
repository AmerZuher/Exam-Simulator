/* ExamPro — Exam Group detail page: scoped stats, custom links, member banks */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Exam Group", sub: "Group progress" };

  View.render = function (root, params) {
    const u = App.u, store = App.store, ui = App.ui;
    const key = decodeURIComponent(params.groupName || "");
    const group = store.getGroup(key);

    if (!group) {
      root.innerHTML = '<div class="view">' + ui.empty({
        icon: "layers", title: "Group not found",
        desc: "This exam group no longer exists. Pick another one from the dashboard.",
        actionsHtml: '<button class="btn btn-primary" onclick="App.router.go(\'#/dashboard\')">Back to dashboard</button>'
      }) + "</div>";
      return;
    }

    const st = store.groupStats(key);
    const links = group.links || [];

    let html = "";

    html += '<button class="btn btn-ghost btn-sm" data-act="back" style="margin-bottom:16px">' +
      App.icon("chevL", 14) + "Back to dashboard</button>";

    html += '<div class="group-head rise">' +
      ui.groupBadge(key, 28, "lg") +
      '<div style="min-width:0"><h2 class="group-head-name">' + u.esc(key) + "</h2>" +
      '<div class="bank-meta">' + st.banks + " exam" + (st.banks === 1 ? "" : "s") + " · " + st.questions + " questions</div>" +
      '<div class="group-head-desc' + (group.description ? "" : " is-blank") + '">' + (group.description ? u.esc(group.description) : "No description added.") + "</div></div>" +
      '<div class="bank-menu" style="margin-left:auto;display:flex;gap:4px">' +
      '<button class="icon-btn" data-gedit="' + u.esc(key) + '" title="Edit group" aria-label="Edit group">' + App.icon("edit", 15) + "</button>" +
      '<button class="icon-btn" data-gdelete="' + u.esc(key) + '" title="Delete group" aria-label="Delete group">' + App.icon("trash", 15) + "</button>" +
      "</div></div>";

    /* scoped stat row — same tiles as the dashboard, filtered to this group */
    html += '<section class="stat-grid" style="margin-top:18px">' +
      App.views.dashboard.statTile("book", st.banks, "Exams in group", 0) +
      App.views.dashboard.statTile("layers", st.questions, "Total questions", 1) +
      App.views.dashboard.statTile("chart", st.attempts, "Attempts taken", 2) +
      App.views.dashboard.statTile("target", st.avg, "Average score", 3, "%") +
      "</section>";

    /* custom links, with an inline add-link control right on the page */
    html += '<div class="sec-head" style="margin-top:30px"><h3>Links</h3>' +
      (links.length ? '<span class="count-badge">' + links.length + "</span>" : "") + "</div>";
    html += '<div class="group-links-panel rise">' +
      '<div id="group-links-list">' + linksListHtml(links, u, ui) + "</div>" +
      '<div class="glink-form">' +
      '<span class="glink-preview-wrap"><img id="glink-preview" class="link-favicon" width="18" height="18" alt="" style="visibility:hidden"></span>' +
      '<input class="input" id="glink-label" placeholder="Label" maxlength="40">' +
      '<input class="input" id="glink-url" placeholder="https://… — paste a link and its logo shows up here" maxlength="300">' +
      '<button class="btn btn-soft btn-sm" id="glink-add">' + App.icon("check", 13) + "Add link</button>" +
      "</div></div>";

    /* member banks — identical cards/behaviour to the dashboard's own grid */
    html += '<div class="sec-head" style="margin-top:30px"><h3>Exam banks in this group</h3>' +
      '<span class="count-badge">' + st.banks + " total</span>" +
      '<div class="sec-actions"><button class="btn btn-ghost btn-sm" data-act="manage-members">' + App.icon("layers", 14) + "Manage banks</button></div></div>";

    if (!st.members.length) {
      html += ui.empty({
        icon: "book",
        title: "No banks in this group yet",
        desc: "Add existing exam banks to this group with the Manage banks button above.",
        actionsHtml: '<button class="btn btn-primary" data-act="manage-members">' + App.icon("layers", 15) + "Add banks</button>"
      });
    } else {
      html += '<div class="bank-grid">';
      st.members.forEach(function (name, i) { html += App.views.dashboard.bankCard(name, i); });
      html += "</div>";
    }

    root.innerHTML = '<div class="view">' + html + "</div>";

    root.querySelectorAll("[data-count]").forEach(function (el) {
      App.u.countUp(el, parseFloat(el.dataset.count), { suffix: el.dataset.suffix || "", duration: 850 });
    });

    wire(root.firstElementChild, key);
  };

  function linksListHtml(links, u, ui) {
    if (!links.length) return '<div class="glink-empty">No links yet — add one below.</div>';
    return '<div class="glinks-grid">' + links.map(function (l) {
      return '<div class="glink-row glink-tile" data-id="' + u.esc(l.id) + '">' +
        '<a class="glink-open" href="' + u.esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
        ui.linkFavicon(l.url, 22) + '<span class="glink-info"><span class="glink-label">' + u.esc(l.label) + "</span>" +
        '<span class="glink-url">' + u.esc(l.url) + "</span></span></a>" +
        '<button class="icon-btn glink-remove" data-e="remove" title="Remove link">' + App.icon("x", 12) + "</button>" +
        "</div>";
    }).join("") + "</div>";
  }

  function wire(wrap, key) {
    const u = App.u, store = App.store, ui = App.ui;
    const rerender = function () { View.render(document.getElementById("view"), { groupName: encodeURIComponent(key) }); };

    App.views.dashboard.wireBankGrid(wrap, rerender);
    App.views.dashboard.wireGroupActions(wrap, rerender, {
      onRenamed: function (newName) { App.router.go("#/group/" + encodeURIComponent(newName)); },
      onDeleted: function () { App.router.go("#/dashboard"); }
    });

    App.u.on(wrap, "click", "[data-act]", function (e, el) {
      const act = el.dataset.act;
      if (act === "back") App.router.go("#/dashboard");
      else if (act === "manage-members") ui.manageGroupMembers(key, rerender);
    });

    const list = wrap.querySelector("#group-links-list");
    App.u.on(list, "click", '[data-e="remove"]', function (e, el) {
      const id = el.closest(".glink-row").dataset.id;
      store.removeGroupLink(key, id);
      rerender();
    });

    const addBtn = wrap.querySelector("#glink-add");
    const urlEl = wrap.querySelector("#glink-url");
    const previewImg = wrap.querySelector("#glink-preview");

    /* Live favicon preview — paste a URL and the site's own logo shows up
       immediately, before the link is even saved. */
    if (urlEl && previewImg) {
      urlEl.addEventListener("input", u.debounce(function () {
        const fav = u.faviconUrl(urlEl.value.trim());
        if (!fav) { previewImg.style.visibility = "hidden"; return; }
        previewImg.onerror = function () { previewImg.style.visibility = "hidden"; };
        previewImg.src = fav;
        previewImg.style.visibility = "visible";
      }, 250));
    }

    if (addBtn) addBtn.onclick = function () {
      const lblEl = wrap.querySelector("#glink-label");
      const lbl = lblEl.value.trim(), url = urlEl.value.trim();
      if (!lbl || !url) { ui.toast("Enter both a label and a URL.", "err"); return; }
      store.addGroupLink(key, lbl, url);
      rerender();
    };
  }

  App.views.group = View;
})();
