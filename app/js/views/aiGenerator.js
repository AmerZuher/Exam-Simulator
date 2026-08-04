/* ExamPro — AI Exam Generator: a configurable prompt builder for any AI tool.
 *
 * Real today: source content, output format, question types, count,
 * difficulty/explanation toggles, and the Copy AI Prompt button that builds
 * off all of it — the user still runs the prompt in their own AI and brings
 * the result back through Import. Everything else (Upload document, Generate
 * Exam's mock preview, Suggested Exam Group, the difficulty spread bars) is
 * a Beta preview of where this page is headed, clearly badged as such.
 */
window.App = window.App || {};
App.views = App.views || {};

(function () {
  const View = { title: "AI Exam Generator", sub: "Configure a prompt, or generate-exam " };

  /* ---------------- module state (reset each visit) ---------------- */
  let sourceTab = "paste";        // "paste" | "upload" (upload is Beta/illustrative)
  let uploadedFileName = null;
  let outputFormat = "json";      // "md" | "json"
  let types = { single: true, multiple: true, matching: true, tf: true };
  let includeDifficulty = false;
  let dist = { easy: 34, medium: 33, hard: 33 };   // Beta — illustrative only
  let includeExplanation = false;
  let includeIncorrect = false;
  let genTimer = null;
  let generatedResult = null;

  const MOCK_QUESTIONS = [
    {
      question: "Which HTTP status code indicates that a request succeeded?",
      options: ["200 OK", "301 Moved Permanently", "404 Not Found", "500 Internal Server Error"],
      correctIndices: [0],
      type: "single",
      difficulty: "Easy",
      confidence: 94,
      explanation: {
        correct: "200 OK is the standard response for a successful HTTP request.",
        incorrect: ["301 is a redirect, not a success status.", "404 means the resource wasn't found.", "500 indicates a server-side error."]
      }
    },
    {
      question: "Select all statements that are true of JavaScript's const declarations. (Select all that apply)",
      options: ["The binding cannot be reassigned", "The value is always deeply immutable", "It is block-scoped", "It must be initialized at declaration"],
      correctIndices: [0, 2, 3],
      type: "multiple",
      difficulty: "Medium",
      confidence: 88,
      explanation: {
        correct: "const prevents reassigning the binding, is block-scoped, and requires an initializer.",
        incorrect: ["Objects/arrays declared with const can still be mutated internally — only the binding itself is fixed."]
      }
    }
  ];

  function betaBadge() { return '<span class="beta-badge">Beta</span>'; }

  /* ---------------- render ---------------- */
  View.render = function (root) {
    sourceTab = "paste";
    uploadedFileName = null;
    generatedResult = null;
    if (genTimer) { clearInterval(genTimer); genTimer = null; }

    root.innerHTML =
      '<div class="view" style="max-width:820px;margin:0 auto">' +

      '<div style="display:flex;justify-content:flex-end;margin-bottom:14px">' +
      '<button class="btn btn-ghost btn-sm" id="gen-open-import">' + App.icon("upload", 14) + "Open Import</button>" +
      "</div>" +

      /* ---- source content ---- */
      '<section class="card card-pad rise settings-card">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("edit", 17) + "</div>" +
      "<div><h3>Source content</h3><p>Optional — paste reference material to ground the exam, or leave it blank and still get a usable prompt template.</p></div></div>" +
      '<div class="seg-tabs">' +
      '<button type="button" class="seg-tab on" data-tab="paste">' + App.icon("edit", 13) + "Paste content</button>" +
      '<button type="button" class="seg-tab" data-tab="upload">' + App.icon("upload", 13) + "Upload document" + betaBadge() + "</button>" +
      "</div>" +
      '<div id="gen-panel-paste" style="margin-top:14px">' +
      '<textarea class="textarea" id="gen-source-text" rows="7" placeholder="Paste your reference material, notes, or existing content here… (optional)"></textarea>' +
      "</div>" +
      '<div id="gen-panel-upload" style="display:none;margin-top:14px">' +
      '<div class="dropzone" id="gen-upload-drop">' +
      '<div class="dz-ico">' + App.icon("upload", 21) + "</div>" +
      '<div><div class="dz-t">Drag &amp; drop a PDF / DOCX / TXT here</div>' +
      '<div class="dz-s">or click to browse · ' + betaBadge() + " parsing is illustrative only — nothing is actually read from the file yet.</div></div>" +
      "</div>" +
      '<input type="file" id="gen-upload-file" accept=".pdf,.docx,.txt" style="display:none">' +
      '<div id="gen-upload-attached" style="display:none;align-items:center;gap:8px;margin-top:10px"></div>' +
      "</div>" +
      "</section>" +

      /* ---- exam settings ---- */
      '<section class="card card-pad rise settings-card" style="animation-delay:.05s">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("layers", 17) + "</div>" +
      "<div><h3>Exam settings</h3><p>Format, size, and the mix of question types to generate.</p></div></div>" +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px" class="set-grid">' +
      "<div><label class='field-lbl'>Output format</label>" +
      '<div class="seg-tabs">' +
      '<button type="button" class="seg-tab" data-format="md">' + App.icon("book", 13) + "Markdown</button>" +
      '<button type="button" class="seg-tab on" data-format="json">' + App.icon("code", 13) + "JSON</button>" +
      "</div></div>" +
      "<div><label class='field-lbl'>Number of questions</label>" +
      '<div class="stepper">' +
      '<button type="button" class="icon-btn" data-step="-1" aria-label="Decrease">' + App.icon("chevL", 14) + "</button>" +
      '<input type="number" class="input" id="gen-count" min="1" max="50" value="20">' +
      '<button type="button" class="icon-btn" data-step="1" aria-label="Increase">' + App.icon("chevR", 14) + "</button>" +
      "</div><div class='field-hint'>50 is the maximum for now.</div></div>" +
      "<div style='grid-column:1/-1'><label class='field-lbl'>Question types to include</label>" +
      '<div class="seg-tabs" style="flex-wrap:wrap">' +
      '<button type="button" class="seg-tab on" data-type="single">Single choice</button>' +
      '<button type="button" class="seg-tab on" data-type="multiple">Multiple choice</button>' +
      '<button type="button" class="seg-tab on" data-type="matching">Matching</button>' +
      '<button type="button" class="seg-tab on" data-type="tf">True/False</button>' +
      "</div></div>" +
      "</div>" +
      "</section>" +

      /* ---- question details ---- */
      '<section class="card card-pad rise settings-card" style="animation-delay:.1s">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("brain", 17) + "</div>" +
      "<div><h3>Question details</h3><p>Optional extras to include on every generated question.</p></div></div>" +
      '<div class="switch-row"><div><div class="sr-txt">Difficulty rating</div><div class="sr-sub">Adds Easy / Medium / Hard to each question.</div></div>' +
      '<label class="switch"><input type="checkbox" id="gen-difficulty-toggle"><span class="track"></span><span class="thumb"></span></label></div>' +
      '<div id="gen-dist-wrap" style="display:none;margin-top:12px">' + distBarsHtml() + "</div>" +
      '<div class="switch-row" style="margin-top:12px"><div><div class="sr-txt">Explanations</div><div class="sr-sub">Adds the reasoning behind the correct answer.</div></div>' +
      '<label class="switch"><input type="checkbox" id="gen-explanation-toggle"><span class="track"></span><span class="thumb"></span></label></div>' +
      '<div id="gen-explanation-sub-wrap" style="display:none;margin-top:10px;margin-left:18px">' +
      '<div class="switch-row"><div><div class="sr-txt" style="font-size:12px">Also explain incorrect options</div></div>' +
      '<label class="switch"><input type="checkbox" id="gen-explanation-incorrect"><span class="track"></span><span class="thumb"></span></label></div>' +
      "</div>" +
      "</section>" +

      /* ---- actions ---- */
      '<section class="card card-pad rise settings-card" style="animation-delay:.15s">' +
      '<div class="set-head" style="margin-bottom:14px"><div class="set-ico">' + App.icon("robot", 17) + "</div>" +
      "<div><h3>Generate</h3><p>Copy a ready-made prompt for any AI tool, or try the Beta in-app generator.</p></div></div>" +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn btn-soft" id="gen-copy-prompt">' + App.icon("robot", 15) + "Copy AI Prompt</button>" +
      '<button class="btn btn-primary" id="gen-generate">' + App.icon("sparkle", 15) + "Generate Exam" + betaBadge() + "</button>" +
      "</div>" +
      '<div id="gen-preview" style="margin-top:16px"></div>' +
      "</section>" +

      suggestedGroupHtml() +

      "</div>";

    wire(root);
  };

  /* ---------------- fragments ---------------- */
  function distBarsHtml() {
    const rows = ["easy", "medium", "hard"].map(function (k) {
      const label = k.charAt(0).toUpperCase() + k.slice(1);
      const tone = k === "easy" ? "ok" : k === "medium" ? "warn" : "bad";
      return '<div class="dist-row">' +
        '<span class="dist-row-lbl">' + label + "</span>" +
        '<input type="range" min="0" max="100" value="' + dist[k] + '" class="dist-slider" data-dist="' + k + '">' +
        '<span class="dist-row-val" id="dist-val-' + k + '">' + dist[k] + "%</span>" +
        "</div>" +
        '<div class="dist-bar"><i class="dist-bar-fill tone-' + tone + '" id="dist-bar-' + k + '" style="width:' + dist[k] + '%"></i></div>';
    }).join("");
    return '<div class="dist-widget">' +
      '<div class="dist-label">' + betaBadge() + " <span>Target difficulty spread — approximate, for preview only</span></div>" +
      rows + "</div>";
  }

  function suggestedGroupHtml() {
    const groups = App.store.groupNames();
    const guess = groups.length ? groups[0] : "General Studies";
    return '<section class="card card-pad rise settings-card" style="animation-delay:.2s">' +
      '<div class="set-head"><div class="set-ico">' + App.icon("sparkle", 17) + "</div>" +
      "<div><h3>Suggested Exam Group " + betaBadge() + "</h3>" +
      '<p>Based on this content, this looks like it belongs in <b>“' + App.u.esc(guess) + '”</b>.</p></div></div>' +
      '<button class="btn btn-soft btn-sm" id="gen-assign-group">' + App.icon("layers", 13) + "Assign to group</button>" +
      "</section>";
  }

  function questionCardHtml(q) {
    const optsHtml = q.options.map(function (opt, i) {
      const correct = q.correctIndices.indexOf(i) !== -1;
      return '<li class="gen-opt' + (correct ? " correct" : "") + '">' +
        (correct ? App.icon("check", 13, 3) : '<span class="gen-opt-dot"></span>') +
        "<span>" + App.u.esc(opt) + "</span></li>";
    }).join("");
    const diffTone = q.difficulty === "Easy" ? "ok" : q.difficulty === "Medium" ? "warn" : "bad";
    const badges = '<span class="confidence-badge">' + App.icon("sparkle", 11, 2.4) + q.confidence + "% confidence</span>" +
      (includeDifficulty ? '<span class="chip chip-' + diffTone + '">' + q.difficulty + "</span>" : "");
    const explHtml = includeExplanation
      ? '<div class="gen-explanation"><b>Why:</b> ' + App.u.esc(q.explanation.correct) +
        (includeIncorrect ? "<ul>" + q.explanation.incorrect.map(function (t) { return "<li>" + App.u.esc(t) + "</li>"; }).join("") + "</ul>" : "") +
        "</div>"
      : "";
    return '<div class="gen-qcard">' +
      '<div class="gen-qcard-badges">' + badges + "</div>" +
      '<div class="gen-qcard-q">' + App.u.esc(q.question) + "</div>" +
      '<ul class="gen-opt-list">' + optsHtml + "</ul>" +
      explHtml +
      "</div>";
  }

  function renderPreviewLoading(box, phases, step) {
    box.style.display = "";
    box.innerHTML = '<div class="gen-loading">' + phases.map(function (p, i) {
      const done = i < step, active = i === step;
      return '<div class="gen-loading-row' + (done ? " done" : "") + (active ? " active" : "") + '">' +
        (done ? App.icon("check", 13, 3) : active ? '<span class="gen-spinner"></span>' : '<span class="gen-loading-dot"></span>') +
        "<span>" + p + "</span></div>";
    }).join("") + "</div>";
  }

  function renderPreviewResult(box) {
    box.style.display = "";
    box.innerHTML =
      '<div class="gen-preview-banner">' + App.icon("info", 14) + betaBadge() +
      "<span>This is a preview — <b>Generate Exam</b> is a Beta mock, not wired to a real pipeline yet. Use <b>Copy AI Prompt</b> above for a working flow today.</span></div>" +
      '<div class="gen-qcards">' + generatedResult.map(questionCardHtml).join("") + "</div>" +
      '<button class="btn btn-ghost" disabled title="Coming soon">' + App.icon("upload", 14) + "Import these questions — coming soon</button>";
  }

  function mockGenerate(root) {
    const box = root.querySelector("#gen-preview");
    if (!box) return;
    if (genTimer) clearInterval(genTimer);
    generatedResult = null;
    const phases = ["Reading your source content…", "Drafting candidate questions…", "Balancing difficulty & checking duplicates…"];
    let step = 0;
    renderPreviewLoading(box, phases, step);
    genTimer = setInterval(function () {
      step++;
      if (step >= phases.length) {
        clearInterval(genTimer);
        genTimer = null;
        generatedResult = MOCK_QUESTIONS;
        renderPreviewResult(box);
      } else {
        renderPreviewLoading(box, phases, step);
      }
    }, 800);
  }

  /* ---------------- prompt building (real) ---------------- */
  function typeList() {
    const list = [];
    if (types.single) list.push("Single Choice");
    if (types.multiple) list.push("Multiple Choice");
    if (types.matching) list.push("Matching");
    if (types.tf) list.push("True/False (formatted as single-choice with exactly two options: True and False)");
    return list.length ? list : ["Single Choice"];
  }

  function schemaExample() {
    const q = {
      question: "Question text",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctIndices: [0],
      type: "single"
    };
    if (includeExplanation) {
      q.explanation = includeIncorrect
        ? { correct: "Why the correct answer is correct.", incorrect: ["Why option A is incorrect.", "Why option B is incorrect.", "Why option C is incorrect.", "Why option D is incorrect."] }
        : { correct: "Why the correct answer is correct." };
    }
    if (includeDifficulty) q.difficulty = "Medium";
    return { questions: [q] };
  }

  function buildPrompt(sourceText, count) {
    const list = typeList();
    const lines = [];

    if (outputFormat === "json") {
      lines.push("Please generate an exam as a single JSON object based on the reference material I provide below.", "",
        "Follow these rules exactly:", "",
        "1. **Question count:** Generate exactly " + count + " questions.",
        "2. **Question types:** Use a mix of: " + list.join(", ") + ". Mix them in random order — do not group by type or add section headers.",
        "3. **Output shape:** Return ONLY a JSON object of this exact shape (no markdown fences, no commentary):", "",
        JSON.stringify(schemaExample(), null, 2), "",
        '4. **type:** one of "single", "multiple", or "matching". Treat True/False as "single" with options ["True","False"].',
        "5. **correctIndices:** zero-based indices into \"options\" that are correct.");
      lines.push(includeDifficulty
        ? "6. **difficulty:** include a \"difficulty\" field on every question — one of \"Easy\", \"Medium\", or \"Hard\"."
        : "6. Do NOT include a \"difficulty\" field.");
      lines.push(includeExplanation
        ? ("7. **explanation:** include an \"explanation\" object per question with a \"correct\" string" +
           (includeIncorrect ? " and an \"incorrect\" array of strings, one per wrong option, explaining why it's wrong." : ". Do not include an \"incorrect\" array."))
        : "7. Do NOT include an \"explanation\" field.");
      lines.push("", "Here is the reference material to base the exam on:", sourceText || "[PASTE YOUR CONTENT HERE]");
    } else {
      lines.push("Please create an exam based on the content I provide you below.", "",
        "Follow these strict formatting and content rules:", "",
        "1. **Question Types:** Create a mix of " + list.join(", ") + ".",
        "2. **Question Count:** Create exactly " + count + " questions.",
        "3. **No Sections:** Do not group the questions by type or create section headers. Mix the question types up and number them sequentially from 1 to " + count + ".",
        "4. **Question Headings:** Format the heading for EVERY question exactly like this: ### 1. [Question Text]",
        "5. **Options Format:** Use - [ ] for all options instead of A), B), C), etc.",
        "Example:", "### 1. What is the capital of France?", "- [ ] London", "- [ ] Paris", "- [ ] Berlin");
      if (types.matching) {
        lines.push("6. **Matching Questions:** For matching questions, format them like this:",
          "### 5. Matching: Match the definitions with the correct items.",
          "- [ ] Option1", "- [ ] Option2", "- [ ] Option3",
          "Definition A: Description of first item", "Definition B: Description of second item", "Definition C: Description of third item",
          "   - The number of - [ ] options MUST equal the number of definitions.",
          '   - Each definition MUST start with "Definition X:" where X is A, B, C, etc.');
      }
      const n = types.matching ? 7 : 6;
      lines.push(n + ". **Answer Key Table:** After all " + count + " questions, provide the Answer Key in a single Markdown table at the very bottom. Use exactly this table format:",
        "| Question Number | Correct Answer |", "| :-------------- | :------------- |", "| 1               | Paris          |",
        (n + 1) + ". **Multi-Choice Answers in Table:** format the correct answers using bullet points and <br> tags for line breaks. Example:",
        "| 2               | • Option 1  <br>• Option 3 |");
      if (types.matching) {
        lines.push((n + 2) + ". **Matching Question Answers in Table:** list the options in the same order as the definitions, separated by commas, e.g. \"Option1, Option2, Option3\". Do NOT use the | character as a separator.");
      }
      if (includeDifficulty) {
        lines.push("Also add a line directly under each question's options reading exactly \"Difficulty: Easy\" (or Medium / Hard). Note: today's Markdown importer does not parse this line automatically — it's for your own reference when reviewing the generated exam.");
      }
      if (includeExplanation) {
        lines.push("Also add a line reading \"Explanation: ...\" explaining why the correct answer is correct" +
          (includeIncorrect ? ", followed by one \"Why not <option>: ...\" line per incorrect option" : "") +
          ". Note: today's Markdown importer does not parse this automatically either — it's for your own reference.");
      }
      lines.push("", "Here is the content to base the exam on:", sourceText || "[PASTE YOUR CONTENT HERE]");
    }

    return lines.join("\n");
  }

  /* ---------------- wiring ---------------- */
  function clampCount(v) {
    v = parseInt(v, 10);
    if (isNaN(v)) v = 20;
    return Math.max(1, Math.min(50, v));
  }

  function wire(root) {
    const u = App.u, ui = App.ui, store = App.store;

    root.querySelector("#gen-open-import").onclick = function () { App.router.go("#/import"); };

    /* source tabs */
    const tabPaste = root.querySelector('[data-tab="paste"]');
    const tabUpload = root.querySelector('[data-tab="upload"]');
    const panelPaste = root.querySelector("#gen-panel-paste");
    const panelUpload = root.querySelector("#gen-panel-upload");
    function setTab(t) {
      sourceTab = t;
      tabPaste.classList.toggle("on", t === "paste");
      tabUpload.classList.toggle("on", t === "upload");
      panelPaste.style.display = t === "paste" ? "" : "none";
      panelUpload.style.display = t === "upload" ? "" : "none";
    }
    tabPaste.onclick = function () { setTab("paste"); };
    tabUpload.onclick = function () { setTab("upload"); };

    /* upload dropzone (Beta — filename only, no real parsing) */
    const upDrop = root.querySelector("#gen-upload-drop");
    const upFile = root.querySelector("#gen-upload-file");
    const upAttached = root.querySelector("#gen-upload-attached");
    function paintAttached() {
      if (!uploadedFileName) { upAttached.style.display = "none"; upAttached.innerHTML = ""; return; }
      upAttached.style.display = "flex";
      upAttached.innerHTML = '<span class="chip chip-mut">' + App.icon("book", 11, 2.2) + u.esc(uploadedFileName) + "</span>" +
        '<button class="icon-btn" id="gen-upload-remove" aria-label="Remove file">' + App.icon("x", 13) + "</button>";
      upAttached.querySelector("#gen-upload-remove").onclick = function () { uploadedFileName = null; paintAttached(); };
    }
    upDrop.onclick = function () { upFile.click(); };
    upFile.onchange = function () { if (upFile.files.length) { uploadedFileName = upFile.files[0].name; paintAttached(); } };
    ["dragover", "dragenter"].forEach(function (ev) { upDrop.addEventListener(ev, function (e) { e.preventDefault(); upDrop.classList.add("drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { upDrop.addEventListener(ev, function (e) { e.preventDefault(); upDrop.classList.remove("drag"); }); });
    upDrop.addEventListener("drop", function (e) { if (e.dataTransfer.files.length) { uploadedFileName = e.dataTransfer.files[0].name; paintAttached(); } });

    /* output format */
    root.querySelectorAll("[data-format]").forEach(function (btn) {
      btn.onclick = function () {
        outputFormat = btn.dataset.format;
        root.querySelectorAll("[data-format]").forEach(function (b) { b.classList.toggle("on", b === btn); });
      };
    });

    /* question types */
    root.querySelectorAll("[data-type]").forEach(function (btn) {
      btn.onclick = function () {
        const key = btn.dataset.type;
        types[key] = !types[key];
        btn.classList.toggle("on", types[key]);
      };
    });

    /* question count stepper */
    const countInput = root.querySelector("#gen-count");
    root.querySelectorAll("[data-step]").forEach(function (btn) {
      btn.onclick = function () {
        countInput.value = clampCount((parseInt(countInput.value, 10) || 20) + parseInt(btn.dataset.step, 10));
      };
    });
    countInput.addEventListener("change", function () { countInput.value = clampCount(countInput.value); });

    /* difficulty toggle + Beta distribution bars */
    const diffToggle = root.querySelector("#gen-difficulty-toggle");
    const distWrap = root.querySelector("#gen-dist-wrap");
    diffToggle.onchange = function () {
      includeDifficulty = diffToggle.checked;
      distWrap.style.display = includeDifficulty ? "" : "none";
    };
    root.querySelectorAll("[data-dist]").forEach(function (slider) {
      slider.addEventListener("input", function () {
        const k = slider.dataset.dist;
        dist[k] = parseInt(slider.value, 10);
        root.querySelector("#dist-val-" + k).textContent = dist[k] + "%";
        root.querySelector("#dist-bar-" + k).style.width = dist[k] + "%";
      });
    });

    /* explanation toggle + sub-toggle */
    const expToggle = root.querySelector("#gen-explanation-toggle");
    const expSubWrap = root.querySelector("#gen-explanation-sub-wrap");
    const expIncorrect = root.querySelector("#gen-explanation-incorrect");
    expToggle.onchange = function () {
      includeExplanation = expToggle.checked;
      expSubWrap.style.display = includeExplanation ? "" : "none";
      if (!includeExplanation) { includeIncorrect = false; expIncorrect.checked = false; }
    };
    expIncorrect.onchange = function () { includeIncorrect = expIncorrect.checked; };

    /* actions — source content is optional; buildPrompt() falls back to a
       placeholder line when it's empty, same as the legacy flat prompt did */
    function validate() {
      if (!types.single && !types.multiple && !types.matching && !types.tf) { ui.toast("Select at least one question type.", "err"); return null; }
      return root.querySelector("#gen-source-text").value;
    }

    root.querySelector("#gen-copy-prompt").onclick = function () {
      const text = validate();
      if (text == null) return;
      ui.copyText(buildPrompt(text, clampCount(countInput.value)), "AI prompt copied to clipboard.");
    };

    root.querySelector("#gen-generate").onclick = function () {
      const text = validate();
      if (text == null) return;
      mockGenerate(root);
    };

    /* Suggested Exam Group (Beta) */
    const assignBtn = root.querySelector("#gen-assign-group");
    if (assignBtn) assignBtn.onclick = function () { ui.toast("Beta — this will wire up once Generate Exam produces a real bank to assign.", "info"); };
  }

  View.destroy = function () { if (genTimer) { clearInterval(genTimer); genTimer = null; } };

  App.views.generator = View;
})();
