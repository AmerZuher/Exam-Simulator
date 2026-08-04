/* ExamPro — hash router */
window.App = window.App || {};

(function () {
  const Router = {
    current: null,
    currentName: null,

    go: function (hash) {
      if (location.hash === hash) Router.render();
      else location.hash = hash;
    },

    parse: function () {
      const h = (location.hash || "").replace(/^#\/?/, "");
      const parts = h.split("/").filter(Boolean);
      const name = parts[0] || "dashboard";
      if (name === "study") return { name: "study", params: { bankKey: parts.slice(1).join("/") } };
      if (name === "review") return { name: "review", params: { bankKey: parts.slice(1).join("/") } };
      if (name === "group") return { name: "group", params: { groupName: parts.slice(1).join("/") } };
      if (name === "import") return { name: "import", params: {} };
      if (name === "exam") return { name: "exam", params: {} };
      if (name === "results") return { name: "results", params: {} };
      if (name === "progress") return { name: "progress", params: {} };
      if (name === "settings") return { name: "settings", params: {} };
      return { name: "dashboard", params: {} };
    },

    render: function () {
      const route = Router.parse();
      const view = App.views[route.name === "import" ? "importer" : route.name] || App.views.dashboard;
      const root = document.getElementById("view");
      if (!root) return;

      /* let the previous view clean up (timers, key handlers, session saves) */
      if (Router.current && Router.current.destroy) {
        try { Router.current.destroy(); } catch (e) { console.warn(e); }
      }
      Router.current = view;
      Router.currentName = route.name;

      view.render(root, route.params);

      if (App.main) {
        App.main.setTopbar(view.title || "", view.sub || "");
        App.main.renderSidebar(route.name);
        App.main.closeSidebar();
      }
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    },

    start: function () {
      window.addEventListener("hashchange", Router.render);
      Router.render();
    }
  };

  App.router = Router;
})();
