/* ExamPro — inline SVG charts.
 *
 * Every chart measures its container and renders at real pixel sizes (no
 * viewBox scaling), so a 2px stroke is genuinely 2px. Each one re-renders on
 * resize and ships a hover layer: line charts get a snapping crosshair, bars
 * and heat cells carry their own tooltip and lift on hover.
 *
 * Colour jobs:
 *   sequential (magnitude) → one hue, the live accent, light → dark
 *   status (pass / below)  → --ok / --bad, always paired with a label
 * Series names are inserted with textContent — never string-concatenated HTML.
 */
window.App = window.App || {};

(function () {
  const C = {};
  const NS = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  /* ---------------- shared tooltip ---------------- */

  function tip() {
    let t = document.getElementById("chart-tip");
    if (!t) {
      t = document.createElement("div");
      t.id = "chart-tip";
      t.className = "chart-tip";
      document.body.appendChild(t);
    }
    return t;
  }

  /* rows: [{ label, value, color }] — label/value set via textContent */
  function showTip(x, y, title, rows) {
    const t = tip();
    t.textContent = "";
    const h = document.createElement("div");
    h.className = "ct-title";
    h.textContent = title;
    t.appendChild(h);
    (rows || []).forEach(function (r) {
      const line = document.createElement("div");
      line.className = "ct-row";
      if (r.color) {
        const key = document.createElement("span");
        key.className = "ct-key";
        key.style.background = r.color;
        line.appendChild(key);
      }
      const v = document.createElement("span");
      v.className = "ct-val";
      v.textContent = r.value;
      line.appendChild(v);
      const l = document.createElement("span");
      l.className = "ct-lbl";
      l.textContent = r.label;
      line.appendChild(l);
      t.appendChild(line);
    });
    t.classList.add("show");
    /* clamp inside the viewport */
    const w = t.offsetWidth, hh = t.offsetHeight;
    t.style.left = App.u.clamp(x - w / 2, 8, innerWidth - w - 8) + "px";
    t.style.top = Math.max(8, y - hh - 12) + "px";
  }
  function hideTip() {
    const t = document.getElementById("chart-tip");
    if (t) t.classList.remove("show");
  }
  C.hideTip = hideTip;

  /* Re-render a chart when its container resizes. */
  function responsive(host, draw) {
    let last = 0;
    function run() {
      const w = host.clientWidth;
      if (!w) return;
      last = w;
      host.textContent = "";
      draw(w);
    }
    run();
    if (host._chartRO) host._chartRO.disconnect();
    if (window.ResizeObserver) {
      host._chartRO = new ResizeObserver(App.u.debounce(function () {
        if (Math.abs(host.clientWidth - last) > 4) run();
      }, 120));
      host._chartRO.observe(host);
    }
  }

  /* ---------------- line chart ---------------- */

  /* points: [{ x (label), y (0-100), meta:{...}, ok:bool }]
     opts: { height, threshold, thresholdLabel, valueSuffix, title } */
  C.line = function (host, points, opts) {
    opts = opts || {};
    responsive(host, function (W) {
      const H = opts.height || 190;
      const padL = 34, padR = 14, padT = 14, padB = 26;
      const iw = Math.max(10, W - padL - padR);
      const ih = H - padT - padB;
      const n = points.length;

      const svg = el("svg", { width: W, height: H, class: "chart-svg", role: "img" });
      const yFor = function (v) { return padT + ih - (App.u.clamp(v, 0, 100) / 100) * ih; };
      const xFor = function (i) { return n === 1 ? padL + iw / 2 : padL + (i / (n - 1)) * iw; };

      /* recessive grid + y labels */
      [0, 25, 50, 75, 100].forEach(function (v) {
        const y = yFor(v);
        svg.appendChild(el("line", { x1: padL, x2: padL + iw, y1: y, y2: y, class: "chart-grid" }));
        const lab = el("text", { x: padL - 8, y: y + 3.5, class: "chart-axis", "text-anchor": "end" });
        lab.textContent = v;
        svg.appendChild(lab);
      });

      /* pass threshold reference */
      if (opts.threshold != null) {
        const ty = yFor(opts.threshold);
        svg.appendChild(el("line", { x1: padL, x2: padL + iw, y1: ty, y2: ty, class: "chart-threshold" }));
        const tl = el("text", { x: padL + iw, y: ty - 6, class: "chart-note", "text-anchor": "end" });
        tl.textContent = opts.thresholdLabel || ("pass " + opts.threshold + "%");
        svg.appendChild(tl);
      }

      if (!n) { host.appendChild(svg); return; }

      /* area + 2px line */
      const dLine = points.map(function (p, i) { return (i ? "L" : "M") + xFor(i).toFixed(1) + " " + yFor(p.y).toFixed(1); }).join(" ");
      const dArea = dLine + " L" + xFor(n - 1).toFixed(1) + " " + (padT + ih) + " L" + xFor(0).toFixed(1) + " " + (padT + ih) + " Z";
      svg.appendChild(el("path", { d: dArea, class: "chart-area" }));
      svg.appendChild(el("path", { d: dLine, class: "chart-line" }));

      /* markers — status colour + a 2px surface ring so overlaps stay readable */
      points.forEach(function (p, i) {
        svg.appendChild(el("circle", {
          cx: xFor(i), cy: yFor(p.y), r: 4.5,
          class: "chart-dot " + (p.ok ? "d-ok" : "d-bad")
        }));
      });

      /* x labels: first, last, and a few between — never every point */
      const step = Math.max(1, Math.ceil(n / 6));
      points.forEach(function (p, i) {
        if (i % step && i !== n - 1) return;
        const t = el("text", { x: xFor(i), y: H - 8, class: "chart-axis", "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" });
        t.textContent = p.x;
        svg.appendChild(t);
      });

      /* crosshair + hit layer */
      const hair = el("line", { x1: 0, x2: 0, y1: padT, y2: padT + ih, class: "chart-hair" });
      const focus = el("circle", { r: 6.5, class: "chart-focus" });
      svg.appendChild(hair);
      svg.appendChild(focus);

      const hit = el("rect", { x: padL, y: padT, width: iw, height: ih, fill: "transparent", style: "cursor:crosshair" });
      svg.appendChild(hit);

      function moveTo(clientX, clientY) {
        const box = svg.getBoundingClientRect();
        const rel = App.u.clamp(clientX - box.left - padL, 0, iw);
        const i = n === 1 ? 0 : Math.round((rel / iw) * (n - 1));
        const p = points[i];
        hair.setAttribute("x1", xFor(i)); hair.setAttribute("x2", xFor(i));
        hair.classList.add("on");
        focus.setAttribute("cx", xFor(i)); focus.setAttribute("cy", yFor(p.y));
        focus.classList.add("on");
        showTip(box.left + xFor(i), box.top + yFor(p.y),
          p.tipTitle || p.x,
          (p.rows || []).concat([{ label: opts.valueLabel || "score", value: p.y + (opts.valueSuffix || "%"), color: p.ok ? "var(--ok)" : "var(--bad)" }]));
      }
      hit.addEventListener("pointermove", function (e) { moveTo(e.clientX, e.clientY); });
      hit.addEventListener("pointerleave", function () {
        hair.classList.remove("on"); focus.classList.remove("on"); hideTip();
      });

      host.appendChild(svg);
    });
  };

  /* ---------------- column chart (review forecast) ---------------- */

  /* bars: [{ label, value, sub }] — sequential accent by magnitude */
  C.columns = function (host, bars, opts) {
    opts = opts || {};
    responsive(host, function (W) {
      const H = opts.height || 150;
      const padT = 18, padB = 24;
      const n = bars.length || 1;
      const gap = 2;                                   /* 2px surface gap between fills */
      const slot = W / n;
      const bw = Math.max(4, slot - gap * 2);
      const max = Math.max(1, bars.reduce(function (m, b) { return Math.max(m, b.value); }, 0));
      const ih = H - padT - padB;

      const svg = el("svg", { width: W, height: H, class: "chart-svg" });

      /* baseline */
      svg.appendChild(el("line", { x1: 0, x2: W, y1: padT + ih, y2: padT + ih, class: "chart-grid" }));

      bars.forEach(function (b, i) {
        const h = b.value ? Math.max(3, (b.value / max) * ih) : 0;
        const x = i * slot + (slot - bw) / 2;
        const y = padT + ih - h;
        const g = el("g", { class: "col-g" + (b.today ? " today" : "") });

        /* hit target is the whole slot, not just the painted bar */
        const hit = el("rect", { x: i * slot, y: padT, width: slot, height: ih, fill: "transparent" });
        if (h) {
          g.appendChild(el("rect", {
            x: x, y: y, width: bw, height: h, rx: 4,   /* 4px rounded data-end */
            class: "col-bar", style: "opacity:" + (0.35 + 0.65 * (b.value / max))
          }));
        }
        g.appendChild(hit);
        g.addEventListener("pointerenter", function (e) {
          const box = svg.getBoundingClientRect();
          showTip(box.left + i * slot + slot / 2, box.top + (h ? y : padT + ih),
            b.tipTitle || b.label, [{ label: opts.unit || "cards due", value: String(b.value), color: "var(--acc)" }]);
          g.classList.add("hot");
        });
        g.addEventListener("pointerleave", function () { g.classList.remove("hot"); hideTip(); });
        svg.appendChild(g);

        /* direct-label only the peak — never a number on every bar */
        if (b.value === max && max > 0) {
          const t = el("text", { x: x + bw / 2, y: y - 6, class: "chart-value", "text-anchor": "middle" });
          t.textContent = b.value;
          svg.appendChild(t);
        }
        if (b.label && (n <= 8 || i % 2 === 0)) {
          const t = el("text", { x: x + bw / 2, y: H - 8, class: "chart-axis", "text-anchor": "middle" });
          t.textContent = b.label;
          svg.appendChild(t);
        }
      });

      host.appendChild(svg);
    });
  };

  /* ---------------- activity heatmap ---------------- */

  /* days: [{ ts, answered, reviews, seconds }] oldest first, one per day */
  C.heatmap = function (host, days, opts) {
    opts = opts || {};
    responsive(host, function (W) {
      const gap = 3;
      const labelW = 22, monthH = 15;
      /* pad the head so week columns start on a Sunday */
      const lead = days.length ? new Date(days[0].ts).getDay() : 0;
      const cells = new Array(lead).fill(null).concat(days);
      const weeks = Math.ceil(cells.length / 7);
      const size = App.u.clamp(Math.floor((W - labelW - gap) / weeks) - gap, 7, 15);
      const H = monthH + 7 * (size + gap);

      const svg = el("svg", { width: W, height: H, class: "chart-svg" });
      const max = days.reduce(function (m, d) { return Math.max(m, d.answered); }, 0) || 1;

      /* weekday guides — Mon / Wed / Fri only, so the column stays quiet */
      ["", "Mon", "", "Wed", "", "Fri", ""].forEach(function (lbl, r) {
        if (!lbl) return;
        const t = el("text", { x: 0, y: monthH + r * (size + gap) + size - 1, class: "chart-axis" });
        t.textContent = lbl;
        svg.appendChild(t);
      });

      let lastMonth = -1;
      cells.forEach(function (d, i) {
        const w = Math.floor(i / 7), r = i % 7;
        const x = labelW + w * (size + gap);
        const y = monthH + r * (size + gap);
        if (!d) return;

        const date = new Date(d.ts);
        if (date.getMonth() !== lastMonth && r <= 1) {
          lastMonth = date.getMonth();
          const t = el("text", { x: x, y: monthH - 5, class: "chart-axis" });
          t.textContent = date.toLocaleDateString(undefined, { month: "short" });
          svg.appendChild(t);
        }

        /* sequential: one hue, five steps, light → dark */
        const lvl = !d.answered ? 0 : App.u.clamp(Math.ceil((d.answered / max) * 4), 1, 4);
        const cell = el("rect", { x: x, y: y, width: size, height: size, rx: 3, class: "heat-cell lvl-" + lvl });
        cell.addEventListener("pointerenter", function () {
          const box = cell.getBoundingClientRect();
          showTip(box.left + box.width / 2, box.top,
            date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
            d.answered
              ? [{ label: "answered", value: String(d.answered), color: "var(--acc)" },
                 { label: "time", value: App.u.fmtDuration(d.seconds), color: "" }]
              : [{ label: "no study", value: "—", color: "" }]);
        });
        cell.addEventListener("pointerleave", hideTip);
        svg.appendChild(cell);
      });

      host.appendChild(svg);
    });
  };

  App.chart = C;
})();
