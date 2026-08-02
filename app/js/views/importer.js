/* ExamPro — Importer view: markdown/JSON import with live parser diagnostics */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "Import", sub: "Add or extend question banks" };

  let format = "md";   // "md" | "json"
  let blockingErrors = 0;   // count of severity:"error" diagnostics for the current content — gates the Save button
  let pendingLook = null;   // { icon, tone, logo } chosen before the bank exists — applied right after it's created
  let multiQueue = null;    // [{ fileName, bankName, format, text }] — dropping several files queues one bank per file

  const MD_PLACEHOLDER =
    "### 1. Your first question&#10;- [ ] Option A&#10;- [ ] Option B&#10;...&#10;" +
    "### Answer Key&#10;| Question Number | Correct Answer |&#10;| 1 | Option B |";

  const JSON_PLACEHOLDER =
    "{&#10;  &quot;name&quot;: &quot;My bank&quot;,&#10;  &quot;questions&quot;: [&#10;    {&#10;" +
    "      &quot;question&quot;: &quot;Capital of France?&quot;,&#10;      &quot;type&quot;: &quot;single&quot;,&#10;" +
    "      &quot;options&quot;: [&quot;London&quot;, &quot;Paris&quot;],&#10;      &quot;correctIndices&quot;: [1]&#10;" +
    "    }&#10;  ]&#10;}";

  const HINTS = {
    md: "Question headings look like <code>### 1. Your question</code>, options like <code>- [ ] Choice</code>, and an answer key table at the end.",
    json: "Either a bare array of questions or <code>{ \"name\", \"questions\": [...] }</code> — the shape produced by <b>Export as JSON</b>."
  };

  /* ---------------- JSON bank parsing ---------------- */

  function findDuplicates(list) {
    const seen = {};
    const dups = [];
    list.forEach(function (v) {
      const n = String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!n) return;
      if (seen[n]) { if (dups.indexOf(v) === -1) dups.push(v); }
      else seen[n] = true;
    });
    return dups;
  }

  /* Fills in whatever a hand-written question omits, so authoring JSON by hand
     works as well as re-importing an export. */
  function normalizeQuestion(raw, i) {
    const q = raw || {};
    const options = Array.isArray(q.options) ? q.options.map(String) : [];
    const leftItems = Array.isArray(q.leftItems) ? q.leftItems.map(String) : [];
    const rightItems = Array.isArray(q.rightItems) ? q.rightItems.map(String) : [];
    const correctAnswers = q.correctAnswers && typeof q.correctAnswers === "object" ? q.correctAnswers : {};
    let correctIndices = Array.isArray(q.correctIndices)
      ? q.correctIndices.map(Number).filter(function (n) { return n >= 0 && n < options.length; })
      : [];

    let type = q.type;
    if (type !== "single" && type !== "multiple" && type !== "matching") {
      if (leftItems.length) type = "matching";
      else type = correctIndices.length > 1 ? "multiple" : "single";
    }
    if (type !== "matching" && !correctIndices.length && options.length) correctIndices = [0];

    return {
      id: i + 1,
      question: String(q.question == null ? "" : q.question).trim(),
      type: type,
      options: options,
      correctIndices: correctIndices,
      leftItems: leftItems,
      rightItems: rightItems.length || type !== "matching" ? rightItems : options.slice(),
      correctAnswers: correctAnswers,
      images: Array.isArray(q.images) ? q.images.map(String) : [],
      audios: Array.isArray(q.audios) ? q.audios.map(String) : [],
      videos: Array.isArray(q.videos) ? q.videos.map(String) : []
    };
  }

  /* -> { name, questions, warnings }; throws with a readable message. */
  function parseJsonBank(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("That isn't valid JSON — " + e.message);
    }
    const rawList = Array.isArray(data) ? data : data && data.questions;
    if (!Array.isArray(rawList)) {
      throw new Error("Expected an array of questions, or an object with a “questions” array.");
    }
    if (!rawList.length) throw new Error("The questions array is empty.");

    const warnings = [];
    const questions = [];
    rawList.forEach(function (raw, i) {
      const q = normalizeQuestion(raw, questions.length);
      const label = "Q" + (i + 1);
      if (!q.question) { warnings.push({ msg: label + ": no question text — skipped." }); return; }
      if (q.type === "matching") {
        if (!q.leftItems.length) { warnings.push({ msg: label + ": matching question has no leftItems — skipped." }); return; }
        if (!Object.keys(q.correctAnswers).length) warnings.push({ msg: label + ": no correctAnswers map — matches will be blank." });
        if (q.rightItems.length && q.leftItems.length !== q.rightItems.length) {
          warnings.push({ severity: "error", msg: label + ": " + q.rightItems.length + " rightItems but " + q.leftItems.length + " leftItems — matching needs exactly one option per definition." });
        }
        const rightDups = findDuplicates(q.rightItems);
        if (rightDups.length) {
          warnings.push({ severity: "error", msg: label + ": duplicate rightItems text (\"" + rightDups.join("\", \"") + "\") — grading can't tell identical options apart." });
        }
        // grading does an exact string compare against rightItems, so any
        // correctAnswers value absent from rightItems will never grade correct.
        let exactCount = 0;
        Object.keys(q.correctAnswers).forEach(function (k) {
          const v = q.correctAnswers[k];
          if (q.rightItems.length && q.rightItems.indexOf(v) === -1) {
            warnings.push({ msg: label + ": correctAnswers[" + k + "] (\"" + v + "\") doesn't exactly match any rightItems entry — it will never grade correct." });
          } else exactCount++;
        });
        if (q.rightItems.length && q.leftItems.length && Object.keys(q.correctAnswers).length && !exactCount) {
          warnings.push({ severity: "error", msg: label + ": none of the correctAnswers values matched a rightItems entry exactly — every row will grade incorrect." });
        }
      } else {
        if (q.options.length < 2) { warnings.push({ msg: label + ": fewer than two options — skipped." }); return; }
        const optDups = findDuplicates(q.options);
        if (optDups.length) {
          warnings.push({ severity: "error", msg: label + ": duplicate option text (\"" + optDups.join("\", \"") + "\") — grading can't tell identical options apart." });
        }
        if (!Array.isArray(raw.correctIndices) || !raw.correctIndices.length) {
          warnings.push({ msg: label + ": no correctIndices — defaulted to the first option." });
        }
      }
      questions.push(q);
    });

    if (!questions.length) throw new Error("No usable questions found in that JSON.");
    questions.forEach(function (q, i) { q.id = i + 1; });
    return {
      name: (!Array.isArray(data) && data.name) ? String(data.name) : "",
      questions: questions,
      warnings: warnings
    };
  }

  View.parseJsonBank = parseJsonBank;

  View.render = function (root) {
    const names = App.store.bankNames();
    pendingLook = null;   // fresh visit — start from the default look each time
    multiQueue = null;

    root.innerHTML =
      '<div class="view" style="max-width:860px;margin:0 auto">' +
      '<section class="card card-pad rise">' +
      '<div style="display:flex;flex-direction:column;gap:18px">' +

      "<div><h2 style='font-size:17px;font-weight:800;letter-spacing:-0.02em'>Import question bank</h2>" +
      "<p style='font-size:12.5px;color:var(--muted);font-weight:500;margin-top:4px'>Drop a markdown file onto this page, paste raw markdown below, or import a previously exported JSON bank. The engine repairs broken characters, detects sections and validates answers live.</p></div>" +

      '<div class="dropzone" id="import-drop">' +
      '<div class="dz-ico">' + App.icon("upload", 21) + "</div>" +
      '<div><div class="dz-t">Drag &amp; drop your file(s) here</div>' +
      '<div class="dz-s">.md / .txt markdown banks · .json exports · drop several at once for separate banks · or click to browse<br>' +
      '<span style="opacity:.75">A single file loads into the editor below so you can check it before saving.</span></div></div>' +
      '<input type="file" id="import-file" accept=".md,.txt,.json" multiple style="display:none">' +
      "</div>" +

      '<div id="import-multi" style="display:none"></div>' +

      '<div id="import-single">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="import-grid">' +
      "<div><label class='field-lbl'>Import method</label><select class='select' id='import-mode'>" +
      '<option value="new">Create a new bank</option><option value="append">Append to an existing bank</option></select></div>' +
      "<div id='import-title-wrap'><label class='field-lbl'>Bank name &amp; icon</label>" +
      '<div style="display:flex;gap:10px;align-items:center">' +
      '<span class="bank-badge editable" id="import-look-badge" role="button" tabindex="0" title="Choose icon or upload a logo"></span>' +
      '<input class="input" id="import-title" placeholder="e.g. PMP Practice Set 1" maxlength="70" style="flex:1"></div></div>' +
      "<div id='import-target-wrap' style='display:none'><label class='field-lbl'>Destination bank</label>" +
      "<select class='select' id='import-target'>" +
      (names.length ? names.map(function (n) { return '<option value="' + App.u.esc(n) + '">' + App.u.esc(n) + "</option>"; }).join("") : '<option value="">No banks yet</option>') +
      "</select></div>" +
      "</div>" +

      "<div><div class='import-content-head'>" +
      "<label class='field-lbl' style='margin:0'>Paste content</label>" +
      '<div class="seg" id="import-format" role="tablist">' +
      '<button class="seg-btn on" data-fmt="md" role="tab">' + App.icon("book", 13) + "Markdown</button>" +
      '<button class="seg-btn" data-fmt="json" role="tab">' + App.icon("code", 13) + "JSON</button>" +
      "</div>" +
      "<button class='linklike' id='ai-copy' style='display:inline-flex;align-items:center;gap:6px;color:var(--acc)'>" + App.icon("robot", 14) + "Copy AI prompt</button></div>" +
      '<textarea class="textarea" id="import-content" rows="11" placeholder="' + MD_PLACEHOLDER + '"></textarea>' +
      "<div class='field-hint' id='import-fmt-hint'>Question headings look like <code>### 1. Your question</code>, options like <code>- [ ] Choice</code>, and an answer key table at the end.</div></div>" +

      '<div id="import-diag" style="display:none"></div>' +

      "</div>" +   /* /#import-single */

      '<div style="display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--line);padding-top:16px">' +
      '<button class="btn btn-ghost" id="import-cancel">Cancel</button>' +
      '<button class="btn btn-primary" id="import-go">' + App.icon("check", 15) + "Parse &amp; save bank</button>" +
      "</div>" +

      "</div></section></div>";

    wire(root);
    App.components.enhanceSelects(root);
    setFormat(root, "md");   // fresh visits start on markdown; content sniffing flips it if needed
  };

  function wire(root) {
    const u = App.u;
    const drop = root.querySelector("#import-drop");
    const file = root.querySelector("#import-file");
    const mode = root.querySelector("#import-mode");
    const content = root.querySelector("#import-content");

    drop.onclick = function () { file.click(); };
    ["dragover", "dragenter"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("drag"); });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files, root);
    });
    file.onchange = function () { if (file.files.length) readFiles(file.files, root); };

    mode.onchange = function () {
      const isNew = mode.value === "new";
      root.querySelector("#import-title-wrap").style.display = isNew ? "" : "none";
      root.querySelector("#import-target-wrap").style.display = isNew ? "none" : "";
    };

    const lookBadge = root.querySelector("#import-look-badge");
    function paintLookBadge() {
      lookBadge.className = "bank-badge editable" +
        (pendingLook && pendingLook.logo ? " has-img" : " tone-" + (pendingLook && pendingLook.tone || "acc"));
      lookBadge.innerHTML = pendingLook && pendingLook.logo
        ? '<img class="bank-badge-img" src="' + App.u.esc(pendingLook.logo) + '" alt="">'
        : App.icon(pendingLook && pendingLook.icon || "grad", 20);
    }
    function openLookPicker() {
      App.ui.pickLook({
        title: "Bank icon",
        subtitle: (root.querySelector("#import-title").value.trim() || "New bank"),
        icon: pendingLook && pendingLook.icon,
        tone: pendingLook && pendingLook.tone,
        logo: pendingLook && pendingLook.logo,
        onSave: function (result) { pendingLook = result; paintLookBadge(); }
      });
    }
    lookBadge.onclick = openLookPicker;
    lookBadge.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLookPicker(); } };
    paintLookBadge();

    content.addEventListener("input", u.debounce(function () { updateDiag(root); }, 220));

    root.querySelectorAll("#import-format .seg-btn").forEach(function (b) {
      b.onclick = function () { setFormat(root, b.dataset.fmt); };
    });

    root.querySelector("#ai-copy").onclick = View.copyAIPrompt;
    root.querySelector("#import-cancel").onclick = function () { App.router.go("#/dashboard"); };
    root.querySelector("#import-go").onclick = function () { doImport(root); };
  }

  /* Content is unambiguous about its own format: JSON always opens with a
     brace or bracket, a markdown bank always has a "### 1." heading. Switching
     automatically means pasting into the "wrong" mode just works. */
  function sniffFormat(text) {
    const t = (text || "").trim();
    if (!t) return null;
    if (/^[{[]/.test(t)) return "json";
    if (/^#{2,5}\s*\d+\s*[.)]/m.test(t)) return "md";
    return null;
  }

  function setFormat(root, fmt) {
    format = fmt === "json" ? "json" : "md";
    const ta = root.querySelector("#import-content");
    const hint = root.querySelector("#import-fmt-hint");
    const ai = root.querySelector("#ai-copy");
    if (!ta || !hint || !ai) return;   // view replaced while a debounce was pending

    root.querySelectorAll("#import-format .seg-btn").forEach(function (b) {
      b.classList.toggle("on", b.dataset.fmt === format);
    });
    ta.setAttribute("placeholder", format === "json"
      ? JSON_PLACEHOLDER.replace(/&#10;/g, "\n").replace(/&quot;/g, '"')
      : MD_PLACEHOLDER.replace(/&#10;/g, "\n"));
    ta.classList.toggle("mono", format === "json");
    hint.innerHTML = HINTS[format];
    ai.style.display = format === "json" ? "none" : "";
    updateDiag(root);
  }

  /* Loads a file into the editor (both formats) rather than importing blind, so
     the diagnostics and the new/append choice still apply. */
  function readFile(f, root) {
    const isJson = /\.json$/i.test(f.name);
    const reader = new FileReader();
    reader.onload = function () {
      setFormat(root, isJson ? "json" : "md");
      let title = f.name.replace(/\.[^.]+$/, "");
      if (isJson) {
        try {
          const probe = JSON.parse(reader.result);
          if (probe && !Array.isArray(probe) && probe.name) title = String(probe.name);
        } catch (e) { /* diagnostics will report it */ }
      }
      root.querySelector("#import-title").value = title;
      root.querySelector("#import-content").value = reader.result;
      updateDiag(root);
      App.ui.toast("File loaded — review the diagnostics below.", "info");
    };
    reader.readAsText(f);
  }

  function readTextFile(f) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("Could not read \"" + f.name + "\".")); };
      reader.readAsText(f);
    });
  }

  /* Dropping several files queues each as its OWN new bank — see
     renderMultiQueue/doImportMulti below. A single file still goes through
     the normal paste-and-review editor. */
  function readFiles(fileList, root) {
    const files = Array.prototype.slice.call(fileList);
    if (!files.length) return;
    if (files.length === 1) { readFile(files[0], root); return; }

    Promise.all(files.map(readTextFile)).then(function (texts) {
      multiQueue = files.map(function (f, i) {
        const isJson = /\.json$/i.test(f.name);
        let bankName = f.name.replace(/\.[^.]+$/, "");
        if (isJson) {
          try {
            const data = JSON.parse(texts[i]);
            if (data && !Array.isArray(data) && data.name) bankName = String(data.name);
          } catch (e) { /* this file's own diagnostics will surface the parse error */ }
        }
        return { fileName: f.name, bankName: bankName, format: isJson ? "json" : "md", text: texts[i] };
      });
      renderMultiQueue(root);
      App.ui.toast(files.length + " files loaded — review each before importing.", "info");
    }).catch(function (e) {
      App.ui.toast(e.message, "err");
    });
  }

  /* { total, errorCount, warningCount, errors, warnings, ok, message } for
     one queued file, using the exact same parse path a single import would
     use — errors/warnings are the raw {msg} lists so a row can be expanded
     to show exactly what's wrong, not just a count. */
  function summarizeFile(entry) {
    if (entry.format === "json") {
      try {
        const res = parseJsonBank(entry.text);
        const errs = res.warnings.filter(function (w) { return w.severity === "error"; });
        const warns = res.warnings.filter(function (w) { return w.severity !== "error"; });
        return { total: res.questions.length, errorCount: errs.length, warningCount: warns.length, errors: errs, warnings: warns, ok: true };
      } catch (e) {
        return { total: 0, errorCount: 1, warningCount: 0, errors: [{ msg: e.message }], warnings: [], ok: false, message: e.message };
      }
    }
    const p = App.parser.preview(entry.text);
    if (!p || !p.total) {
      const msg = "No questions found — headings must look like “### 1. Question”.";
      return { total: 0, errorCount: 0, warningCount: 0, errors: [], warnings: [], ok: false, message: msg };
    }
    return { total: p.total, errorCount: p.errorCount || 0, warningCount: p.warningCount || 0, errors: p.errors || [], warnings: p.warnings || [], ok: true };
  }

  function statusChipHtml(sum, expandable) {
    const chev = expandable ? App.icon("chevDown", 12, 2.4) : "";
    if (!sum.ok) {
      return '<span class="warn-item" style="color:var(--bad);background:var(--bad-soft);border-color:var(--bad-line);white-space:nowrap">' +
        App.icon("warn", 12, 2.2) + "<span>" + App.u.esc(sum.message) + "</span></span>";
    }
    if (sum.errorCount) {
      return '<span class="warn-item" style="color:var(--bad);background:var(--bad-soft);border-color:var(--bad-line);white-space:nowrap">' +
        App.icon("warn", 12, 2.2) + "<span>" + sum.total + " questions · " + sum.errorCount + " error(s)</span>" + chev + "</span>";
    }
    if (sum.warningCount) {
      return '<span class="warn-item" style="white-space:nowrap">' + App.icon("warn", 12, 2.2) +
        "<span>" + sum.total + " questions · " + sum.warningCount + " warning(s)</span>" + chev + "</span>";
    }
    return '<span class="warn-item" style="color:var(--ok);background:var(--ok-soft);border-color:var(--ok-line);white-space:nowrap">' +
      App.icon("check", 12, 2.4) + "<span>" + sum.total + " questions · clean</span></span>";
  }

  /* The full message list for one row's expanded detail panel — same visual
     language as the single-import diagnostics box. */
  function fileDetailHtml(entry, sum) {
    const errHtml = sum.errorCount
      ? sum.errors.map(function (w) {
          return '<div class="warn-item" style="color:var(--bad);background:var(--bad-soft);border-color:var(--bad-line)">' +
            App.icon("warn", 13, 2.2) + "<span>" + App.u.esc(w.msg) + "</span></div>";
        }).join("")
      : "";
    const warnHtml = sum.warningCount
      ? sum.warnings.map(function (w) {
          return '<div class="warn-item">' + App.icon("warn", 13, 2.2) + "<span>" + App.u.esc(w.msg) + "</span></div>";
        }).join("")
      : "";
    return '<div class="warn-list" style="margin-top:10px">' + errHtml + warnHtml + "</div>" +
      '<div style="display:flex;justify-content:flex-end;margin-top:8px">' +
      '<button class="linklike" data-copy-idx="__IDX__" style="display:inline-flex;align-items:center;gap:6px;color:var(--acc);font-size:11.5px;font-weight:700">' +
      App.icon("robot", 13) + "Copy issues for AI</button></div>";
  }

  /* Renders the multi-file queue in place of the normal single-file editor,
     one row per file (editable bank name, live diagnostics chip, remove,
     and — when there's something to see — an expandable detail panel with
     the exact warning/error messages), and repoints the shared
     Cancel/Save buttons at the batch actions. */
  function renderMultiQueue(root) {
    const box = root.querySelector("#import-multi");
    const single = root.querySelector("#import-single");
    if (!box || !single) return;

    if (!multiQueue || !multiQueue.length) {
      multiQueue = null;
      box.style.display = "none";
      box.innerHTML = "";
      single.style.display = "";
      restoreGoButton(root);
      return;
    }

    single.style.display = "none";
    box.style.display = "";

    const summaries = multiQueue.map(summarizeFile);

    box.innerHTML =
      '<div class="field-lbl">' + multiQueue.length + " file(s) queued — each becomes its own new bank</div>" +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">' +
      multiQueue.map(function (entry, i) {
        const sum = summaries[i];
        const hasIssues = !sum.ok || sum.errorCount > 0 || sum.warningCount > 0;
        return '<div class="card" style="padding:12px 14px">' +
          '<div style="display:flex;align-items:center;gap:12px">' +
          '<div style="flex:1;min-width:0">' +
          '<input class="input" data-name-idx="' + i + '" value="' + App.u.esc(entry.bankName) + '" maxlength="70" style="margin-bottom:6px">' +
          '<div style="font-size:11px;color:var(--muted);font-weight:600">' + App.u.esc(entry.fileName) + " · " + (entry.format === "json" ? "JSON" : "Markdown") + "</div>" +
          "</div>" +
          (hasIssues && sum.ok
            ? '<button class="linklike" data-toggle-idx="' + i + '" style="padding:0;border:0;background:none">' + statusChipHtml(sum, true) + "</button>"
            : statusChipHtml(sum, false)) +
          '<button class="icon-btn" data-remove-idx="' + i + '" aria-label="Remove ' + App.u.esc(entry.fileName) + '">' + App.icon("x", 14) + "</button>" +
          "</div>" +
          (entry.expanded && sum.ok && hasIssues ? fileDetailHtml(entry, sum).replace("__IDX__", i) : "") +
          "</div>";
      }).join("") +
      "</div>";

    box.querySelectorAll("[data-name-idx]").forEach(function (inp) {
      inp.oninput = function () { multiQueue[parseInt(inp.dataset.nameIdx, 10)].bankName = inp.value; };
    });
    box.querySelectorAll("[data-remove-idx]").forEach(function (btn) {
      btn.onclick = function () {
        multiQueue.splice(parseInt(btn.dataset.removeIdx, 10), 1);
        renderMultiQueue(root);
      };
    });
    box.querySelectorAll("[data-toggle-idx]").forEach(function (btn) {
      btn.onclick = function () {
        const idx = parseInt(btn.dataset.toggleIdx, 10);
        multiQueue[idx].expanded = !multiQueue[idx].expanded;
        renderMultiQueue(root);
      };
    });
    box.querySelectorAll("[data-copy-idx]").forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.copyIdx, 10);
        const sum = summaries[idx];
        App.ui.copyText(diagnosticsReportText(sum), "Diagnostics copied — paste them to the AI that generated this exam to get a corrected file.");
      };
    });

    setGoButtonForMulti(root, summaries);
  }

  function setGoButtonForMulti(root, summaries) {
    const go = root.querySelector("#import-go");
    const cancel = root.querySelector("#import-cancel");
    if (!go) return;
    const importable = summaries.filter(function (s) { return s.ok && !s.errorCount; }).length;
    go.innerHTML = App.icon("check", 15) + "Import " + multiQueue.length + " bank" + (multiQueue.length === 1 ? "" : "s");
    go.disabled = false;
    go.title = importable < multiQueue.length ? (multiQueue.length - importable) + " file(s) with errors will be skipped." : "";
    go.onclick = function () { doImportMulti(root); };
    if (cancel) cancel.onclick = function () { multiQueue = null; renderMultiQueue(root); };
  }

  function restoreGoButton(root) {
    const go = root.querySelector("#import-go");
    const cancel = root.querySelector("#import-cancel");
    if (!go) return;
    go.innerHTML = App.icon("check", 15) + "Parse &amp; save bank";
    go.title = "";
    go.onclick = function () { doImport(root); };
    if (cancel) cancel.onclick = function () { App.router.go("#/dashboard"); };
  }

  /* Creates one new bank per queued file, same as the single-file path
     would, but skips (and reports) any file with a blocking error instead
     of stalling the whole batch on it. */
  function doImportMulti(root) {
    if (!multiQueue || !multiQueue.length) return;
    let created = 0;
    const problems = [];

    multiQueue.forEach(function (entry) {
      const name = (entry.bankName || "").trim() || entry.fileName.replace(/\.[^.]+$/, "");
      try {
        let questions;
        if (entry.format === "json") {
          const res = parseJsonBank(entry.text);
          const errs = res.warnings.filter(function (w) { return w.severity === "error"; });
          if (errs.length) { problems.push(name + ": " + errs.length + " error(s) — skipped."); return; }
          questions = res.questions;
        } else {
          const res = App.parser.parse(entry.text);
          if (!res.questions.length) { problems.push(name + ": no questions found — skipped."); return; }
          const errs = res.warnings.filter(function (w) { return w.severity === "error"; });
          if (errs.length) { problems.push(name + ": " + errs.length + " error(s) — skipped."); return; }
          questions = res.questions;
        }
        App.store.addBank(name, questions);
        created++;
      } catch (e) {
        problems.push(name + ": " + e.message + " — skipped.");
      }
    });

    if (created) {
      App.ui.toast(created + " bank" + (created === 1 ? "" : "s") + " created" + (problems.length ? " (" + problems.length + " skipped)" : "") + ".", problems.length ? "info" : "ok");
    } else {
      App.ui.toast("Nothing imported — every file had blocking errors.", "err");
    }
    problems.forEach(function (msg) { App.ui.toast(msg, "err"); });

    if (created) {
      multiQueue = null;
      App.router.go("#/dashboard");
    } else {
      renderMultiQueue(root);   // stay put so the user can remove/fix the problem files
    }
  }

  /* Keeps the "Parse & save bank" button in sync with the last computed
     error count — called after every diagnostics refresh. */
  function setSaveGate(root, errorCount) {
    blockingErrors = errorCount;
    const go = root.querySelector("#import-go");
    if (!go) return;
    go.disabled = errorCount > 0;
    go.title = errorCount > 0 ? "Fix " + errorCount + " error(s) below before importing." : "";
  }

  function updateDiag(root) {
    const box = root.querySelector("#import-diag");
    const ta = root.querySelector("#import-content");
    /* the debounced handler can land after the view has been swapped out */
    if (!box || !ta) return;

    const text = ta.value;
    if (!text.trim()) { box.style.display = "none"; box.innerHTML = ""; setSaveGate(root, 0); return; }

    const sniffed = sniffFormat(text);
    if (sniffed && sniffed !== format) { setFormat(root, sniffed); return; }

    let p;
    if (format === "json") {
      try {
        const res = parseJsonBank(text);
        const types = { single: 0, multiple: 0, matching: 0 };
        res.questions.forEach(function (q) { types[q.type]++; });
        const errors = res.warnings.filter(function (w) { return w.severity === "error"; });
        const soft = res.warnings.filter(function (w) { return w.severity !== "error"; });
        p = {
          blocks: 1, total: res.questions.length, types: types,
          errors: errors, errorCount: errors.length,
          warnings: soft.slice(0, 24), warningCount: soft.length,
          blockLabel: res.name ? "“" + res.name + "”" : "1"
        };
      } catch (e) {
        box.style.display = "";
        box.innerHTML = '<div class="warn-item" style="color:var(--bad);background:var(--bad-soft);border-color:var(--bad-line)">' +
          App.icon("warn", 13, 2.2) + "<span>" + App.u.esc(e.message) + "</span></div>";
        setSaveGate(root, 1);
        return;
      }
    } else {
      p = App.parser.preview(text);
    }
    if (!p) { box.style.display = "none"; setSaveGate(root, 0); return; }

    setSaveGate(root, p.errorCount || 0);

    const errHtml = p.errorCount
      ? '<div class="warn-list" style="margin-bottom:8px">' +
        '<div class="warn-item" style="color:var(--bad);background:var(--bad-soft);border-color:var(--bad-line);font-weight:700">' +
        App.icon("warn", 13, 2.2) + "<span>" + p.errorCount + " error(s) must be fixed before this bank can be imported:</span></div>" +
        p.errors.map(function (w) {
          return '<div class="warn-item" style="color:var(--bad);background:var(--bad-soft);border-color:var(--bad-line)">' +
            App.icon("warn", 13, 2.2) + "<span>" + App.u.esc(w.msg) + "</span></div>";
        }).join("") + "</div>"
      : "";

    const warnHtml = p.warningCount
      ? '<div class="warn-list">' + p.warnings.map(function (w) {
          return '<div class="warn-item">' + App.icon("warn", 13, 2.2) + "<span>" + App.u.esc(w.msg) + "</span></div>";
        }).join("") +
        (p.warningCount > p.warnings.length ? '<div class="warn-item">' + App.icon("info", 13, 2.2) + "<span>…and " + (p.warningCount - p.warnings.length) + " more</span></div>" : "") +
        "</div>"
      : (p.errorCount ? "" : '<div class="warn-item" style="color:var(--ok);background:var(--ok-soft);border-color:var(--ok-line)">' + App.icon("check", 13, 2.4) +
        "<span>" + (format === "json" ? "Valid bank — every question has options and an answer." : "Clean parse — every answer key matched its options.") + "</span></div>");

    const hasIssues = (p.errorCount || 0) + (p.warningCount || 0) > 0;
    const copyBtnHtml = hasIssues
      ? '<div style="display:flex;justify-content:flex-end;margin-bottom:8px">' +
        '<button class="linklike" id="diag-copy-ai" style="display:inline-flex;align-items:center;gap:6px;color:var(--acc);font-size:11.5px;font-weight:700">' +
        App.icon("robot", 13) + "Copy issues for AI</button></div>"
      : "";

    box.style.display = "";
    box.innerHTML =
      '<div class="diag">' +
      '<div class="diag-tile"><div class="dt-n">' + (p.blockLabel || p.blocks) + '</div><div class="dt-l">' +
      (format === "json" ? "Source bank" : "Document sections") + "</div></div>" +
      '<div class="diag-tile"><div class="dt-n">' + p.total + '</div><div class="dt-l">Questions parsed</div></div>' +
      '<div class="diag-tile"><div class="dt-n" style="font-size:13px;line-height:2">' + p.types.single + " single · " + p.types.multiple + " multi · " + p.types.matching + ' match</div><div class="dt-l">Type breakdown</div></div>' +
      "</div>" + copyBtnHtml + errHtml + warnHtml;

    if (hasIssues) {
      box.querySelector("#diag-copy-ai").onclick = function () {
        App.ui.copyText(diagnosticsReportText(p), "Diagnostics copied — paste them to the AI that generated this exam to get a corrected file.");
      };
    }
  }

  function doImport(root) {
    const mode = root.querySelector("#import-mode").value;
    const title = root.querySelector("#import-title").value.trim();
    const target = root.querySelector("#import-target").value;
    const text = root.querySelector("#import-content").value;

    if (!text.trim()) { App.ui.toast("Paste or drop some content first.", "err"); return; }
    if (mode === "append" && !target) { App.ui.toast("Choose a destination bank.", "err"); return; }
    if (blockingErrors > 0) { App.ui.toast("Fix the " + blockingErrors + " error(s) shown in diagnostics first.", "err"); return; }

    let res;
    if (format === "json") {
      try {
        res = parseJsonBank(text);
      } catch (e) {
        App.ui.toast(e.message, "err");
        return;
      }
      /* an exported bank carries its own name — use it when none was typed */
      if (mode === "new" && !title && res.name) {
        root.querySelector("#import-title").value = res.name;
      }
    } else {
      res = App.parser.parse(text);
      if (!res.questions.length) {
        App.ui.toast("No questions found — headings must look like “### 1. Question”.", "err");
        return;
      }
    }

    const finalTitle = title || (format === "json" ? res.name : "");
    if (mode === "new" && !finalTitle) { App.ui.toast("Give the new bank a name.", "err"); return; }

    if (mode === "new") {
      const final = App.store.addBank(finalTitle, res.questions);
      if (pendingLook) App.store.setBankLook(final, pendingLook.icon, pendingLook.tone, pendingLook.logo);
      App.ui.toast("Bank “" + final + "” created with " + res.questions.length + " questions.", "ok");
    } else {
      const offset = App.store.appendToBank(target, res.questions);
      App.ui.toast(res.questions.length + " questions appended from #" + (offset + 1) + ".", "ok");
    }
    App.router.go("#/dashboard");
  }

  /* The AI exam-generation prompt (kept from the legacy app, tightened) */
  /* Turns the current parse diagnostics into a plain-text report meant to be
     pasted straight back to whichever AI generated the exam — each item
     quotes the exact offending value and states the fix in terms of this
     app's own formatting rules (see View.copyAIPrompt), so the AI can act on
     it without any extra back-and-forth. */
  function diagnosticsReportText(p) {
    const lines = [
      "The exam file you generated has formatting problems that ExamPro's importer caught — please fix these in the source and resend the corrected file. Don't change question content, only the formatting issues listed below.",
      ""
    ];
    if (p.errorCount) {
      lines.push("BLOCKING ERRORS (the bank can't be imported until these are fixed):");
      p.errors.forEach(function (w, i) { lines.push((i + 1) + ". " + w.msg); });
      lines.push("");
    }
    if (p.warningCount) {
      lines.push("WARNINGS (importable, but double-check these):");
      p.warnings.forEach(function (w, i) { lines.push((i + 1) + ". " + w.msg); });
      lines.push("");
    }
    lines.push("Formatting reference: question headings are \"### N. Question text\", options are \"- [ ] Choice\", matching definitions are one \"Definition X: text\" per line with exactly one option per definition, and the answer key is a \"| Question Number | Correct Answer |\" table where matching answers list the options in definition order separated by commas.");
    return lines.join("\n");
  }

  View.copyAIPrompt = function () {
    const prompt = [
      "Please create an exam based on the content I provide you below.",
      "",
      "Follow these strict formatting and content rules:",
      "",
      '1. **Question Types:** Create a mix of Single Choice, Multi Choice, "Choose the right word with the def", True/False, and Matching questions. Treat True/False as single-choice questions (with options True and False).',
      "2. **Question Count:** Create exactly 20 questions.",
      "3. **No Sections:** Do not group the questions by type or create section headers. Mix the question types up and number them sequentially from 1 to 20.",
      "4. **Question Headings:** Format the heading for EVERY question exactly like this: ### 1. [Question Text]",
      "5. **Options Format:** Use - [ ]  for all options instead of A), B), C), etc.",
      "Example:",
      "### 1. What is the capital of France?",
      "- [ ] London",
      "- [ ] Paris",
      "- [ ] Berlin",
      "6. **Choose the Right Word Questions:** For these, provide the definition in the question text, and format the options as a standard list of words using - [ ] .",
      "7. **Matching Questions:** For matching questions, format them like this:",
      "### 5. Matching: Match the definitions with the correct items.",
      "- [ ] Option1",
      "- [ ] Option2",
      "- [ ] Option3",
      "Definition A: Description of first item",
      "Definition B: Description of second item",
      "Definition C: Description of third item",
      "   - The number of - [ ] options MUST equal the number of definitions.",
      '   - Each definition MUST start with "Definition X:" where X is A, B, C, etc.',
      "8. **Answer Key Table:** After all 20 questions, provide the Answer Key in a single Markdown table at the very bottom. Use exactly this table format:",
      "| Question Number | Correct Answer |",
      "| :-------------- | :------------- |",
      "| 1               | Paris          |",
      "9. **Multi-Choice Answers in Table:** For multi-choice questions, format the correct answers in the table using bullet points and <br> tags for line breaks. Example:",
      "| 2               | • Option 1  <br>• Option 3 |",
      "10. **Matching Question Answers in Table:** For matching questions, list the options in the same order as the definitions, separated by commas. Example:",
      "| 5               | Option1, Option2, Option3 |",
      "    Do NOT use the | character as a separator in the answer — use commas only.",
      "",
      "Here is the content to base the exam on:",
      "[PASTE YOUR CONTENT HERE]"
    ].join("\n");

    App.ui.copyText(prompt, "AI prompt copied to clipboard.");
  };

  App.views.importer = View;
})();
