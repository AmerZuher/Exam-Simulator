/* ExamPro — markdown exam parser engine (DOM-free, unit-testable)
 *
 * Supports:
 *  - "### N. Question" headings (numbering may restart across sections)
 *  - Options written as "- [ ] text" or plain "- text" / "* text"
 *  - Single / multiple / true-false / matching question types
 *  - Answer keys as markdown tables ("| Question | Answer |") or "- Q1: answer" lists
 *  - Multi answers separated by bullets (•, �?�), <br>, or table cells
 *  - Matching answers as comma/pipe separated values in definition order
 *  - Letter answers ("B", "C) text") mapped onto option indices
 *  - Mojibake repair for UTF-8 files that were saved/read as CP1252
 */
window.App = window.App || {};

(function () {
  /* ---------------- mojibake repair ---------------- */
  const MOJI = [
    [/â€™/g, "'"], [/â€˜/g, "'"], [/â€œ/g, '"'], [/â€\u009D/g, '"'], [/â€�/g, '"'],
    [/â€“/g, "–"], [/â€”/g, "—"], [/â€¦/g, "…"], [/â€¢/g, "•"], [/â„¢/g, "™"],
    [/ï¿½|�\?�|�/g, "•"], [/Â(?=\s|$)/g, ""], [/Ã©/g, "é"], [/Ã¨/g, "è"],
    [/Ã±/g, "ñ"], [/Ã¼/g, "ü"], [/Ã¶/g, "ö"], [/Ã¤/g, "ä"], [/Ã§/g, "ç"]
  ];

  function fixMojibake(str) {
    if (!str) return "";
    let out = String(str);
    for (let i = 0; i < MOJI.length; i++) out = out.replace(MOJI[i][0], MOJI[i][1]);
    return out;
  }

  /* ---------------- helpers ---------------- */
  function stripMd(str) {
    return String(str || "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")        // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")      // links -> text
      .replace(/\*\*([^*]*)\*\*/g, "$1")            // bold
      .replace(/__([^_]*)__/g, "$1")
      .replace(/\*([^*]*)\*/g, "$1")                // italics
      .replace(/_([^_]*)_/g, "$1")
      .replace(/`([^`]*)`/g, "$1")                  // code
      .replace(/<[^>]*>/g, " ")                     // html tags
      .replace(/\s+/g, " ")
      .trim();
  }

  function norm(str) {
    return stripMd(str)
      .toLowerCase()
      .replace(/&[a-z]+;/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  const isTableRow = (l) => /^\|.*\|$/.test(l.trim());
  const isTableSep = (l) => /^\|[\s:|-]+\|$/.test(l.trim());

  /* ``` or ~~~ — fenced code is documentation, never questions */
  const isFence = (l) => /^\s*(```|~~~)/.test(l);

  function isQuestionHeading(line) {
    return /^#{2,5}\s*\d+\s*[.)]/.test(line.trim());
  }

  function isAnswerKeyStart(line) {
    const l = line.trim();
    // a numbered question may legitimately mention "answer key" in its text
    if (isQuestionHeading(l)) return false;
    if (/^#{1,6}\s*.*answer\s*key/i.test(l)) return true;
    if (/^\*\*.*answer\s*key.*\*\*$/i.test(l)) return true;
    // table header containing "question" + "answer" cells
    if (isTableRow(l) && /question/i.test(l) && /answer/i.test(l)) return true;
    return false;
  }

  /* Split a document into independent blocks: a new block starts when a
     question heading appears AFTER an answer key was already seen. */
  function splitBlocks(rawText) {
    const lines = String(rawText).split(/\r?\n/);
    const blocks = [];
    let cur = [];
    let seenKey = false;
    let inFence = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isFence(line)) inFence = !inFence;
      else if (!inFence) {
        if (isAnswerKeyStart(line)) seenKey = true;
        if (seenKey && isQuestionHeading(line) && cur.length) {
          blocks.push(cur.join("\n"));
          cur = [];
          seenKey = false;
        }
      }
      cur.push(line);
    }
    if (cur.join("\n").trim()) blocks.push(cur.join("\n"));
    return blocks;
  }

  /* ---------------- answer key parsing ---------------- */
  function parseAnswerKey(text) {
    // returns { qnum: rawAnswerString }
    const map = {};
    const lines = text.split("\n");
    let pendingQnum = null; // handles table cells that wrap onto following lines? (rare) — kept simple

    lines.forEach(function (raw) {
      const line = raw.trim();
      if (!line) return;

      if (isTableRow(line) && !isTableSep(line)) {
        const escaped = line.replace(/\\\|/g, "__PIPE__");
        const cells = escaped.split("|").slice(1, -1).map(function (c) {
          return c.trim().replace(/__PIPE__/g, "|");
        });
        if (cells.length >= 2) {
          const first = cells[0].replace(/\*\*/g, "").trim();
          const m = first.match(/(\d+)/);
          if (m && !/question/i.test(first)) {
            const qnum = parseInt(m[1], 10);
            const ans = cells.slice(1).join(" | ").trim();
            if (ans && !/^-+$/.test(ans)) {
              if (!map[qnum]) map[qnum] = ans;
              else map[qnum] = map[qnum] + " \u2022 " + ans;
            }
          }
        }
        return;
      }

      // "- Q3: answer" / "* 3) answer" / "3. answer" list styles
      const lm = line.match(/^[-*]?\s*\**(?:Q(?:uestion)?\s*)?(\d+)\s*[).:\-]\s*\**(.+)/i);
      if (lm) {
        const qnum = parseInt(lm[1], 10);
        const ans = lm[2].trim();
        if (!map[qnum]) map[qnum] = ans;
        else map[qnum] = map[qnum] + " \u2022 " + ans;
      }
    });

    return map;
  }

  /* Split a raw answer-cell string into individual answer values.
     For non-matching questions we ONLY split on explicit separators
     (bullets, <br>, table pipes) — never on commas, because real answers
     often contain commas (e.g. "Unit, descendants, and ancestors"). */
  function splitAnswerValues(raw, forMatching) {
    if (!raw) return [];
    let s = fixMojibake(raw);
    s = s.replace(/<br\s*\/?>/gi, " • ").replace(/&bull;/g, "•");
    let parts;
    if (forMatching) {
      parts = s.split(/\s*(?:\||,|•)\s*/);
    } else {
      parts = s.split(/\s*(?:•|\|)\s*/);
    }
    return parts.map(stripMd).filter(Boolean);
  }

  /* Pull every "Definition X: ..." / "Step N: ..." pair out of a line. Only
     fires when the line itself opens with a label (preserves the old
     line-must-start-with-label behavior) but then finds ALL labels in the
     line, not just the first — so a paragraph that jams "Definition A: ...
     Definition B: ..." onto one line still yields separate items instead of
     one item whose text swallows every definition after the first. */
  function extractDefinitions(line) {
    if (!/^(?:Definition|Step)\s+[A-Za-z0-9]+\s*:/i.test(line)) return null;
    const re = /(Definition|Step)\s+([A-Za-z0-9]+)\s*:\s*/gi;
    const marks = [];
    let m;
    while ((m = re.exec(line))) marks.push({ start: m.index, end: re.lastIndex, label: m[1] + " " + m[2] });
    if (!marks.length) return null;
    const out = [];
    for (let i = 0; i < marks.length; i++) {
      const end = i + 1 < marks.length ? marks[i + 1].start : line.length;
      const text = stripMd(line.slice(marks[i].end, end));
      out.push(marks[i].label + ": " + text);
    }
    return out;
  }

  /* Map a letter answer ("B", "c)") to an option index */
  function letterIndex(ans) {
    const m = String(ans).trim().match(/^([A-Za-z])\s*[).:]?\s*$/);
    if (!m) return -1;
    const idx = m[1].toUpperCase().charCodeAt(0) - 65;
    return idx >= 0 && idx < 26 ? idx : -1;
  }

  /* Normalized-duplicate text within a list of options — grading can't tell
     two identically-worded choices apart, so this always signals a broken
     question rather than a merely sloppy one. */
  function findDuplicates(list) {
    const seen = {};
    const dups = [];
    list.forEach(function (v) {
      const n = norm(v);
      if (!n) return;
      if (seen[n]) { if (dups.indexOf(v) === -1) dups.push(v); }
      else seen[n] = true;
    });
    return dups;
  }

  /* Word-overlap fallback scoring (stop words removed) — used only when
     exact/containment matching fails for a value. */
  const STOP_WORDS = { and: 1, or: 1, the: 1, a: 1, an: 1, of: 1, to: 1, in: 1, for: 1, on: 1, with: 1, is: 1, are: 1, by: 1, at: 1, as: 1, vs: 1 };
  function contentWords(s) {
    return norm(s).split(" ").filter(function (w) { return w && !STOP_WORDS[w]; });
  }
  function overlapScore(aWords, bSet) {
    if (!aWords.length || !bSet.size) return 0;
    let hit = 0;
    aWords.forEach(function (w) { if (bSet.has(w)) hit++; });
    return hit / aWords.length;
  }

  /* ---------------- main block parser ---------------- */
  function parseBlock(text, warnings) {
    const fixed = fixMojibake(text);
    const lines = fixed.split("\n");
    const questions = [];
    let cur = null;
    let inKey = false;
    let keyText = "";
    let inFence = false;

    function pushCur() { if (cur) { questions.push(cur); cur = null; } }

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();

      /* fenced code is illustrative markup, not content */
      if (isFence(line)) { inFence = !inFence; continue; }
      if (inFence) continue;

      if (!inKey && isAnswerKeyStart(line)) { inKey = true; keyText += line + "\n"; continue; }
      if (inKey) {
        // allow leaving the key if a new question heading starts (defensive)
        if (isQuestionHeading(line)) { inKey = false; }
        else { keyText += line + "\n"; continue; }
      }

      if (isQuestionHeading(line)) {
        pushCur();
        const body = line.replace(/^#{2,5}\s*/, "");
        const m = body.match(/^(\d+)\s*[.)]\s*(.*)$/);
cur = {
            origId: m ? parseInt(m[1], 10) : null,
            question: stripMd(m ? m[2] : body),
            options: [],
            images: [],
            audios: [],
            videos: [],
            leftItems: [],
            rightItems: [],
            correctAnswers: {},
            correctIndices: [],
            answerText: "",
            type: "single",
            rawBody: ""
          };
        continue;
      }

      if (!cur) continue;
      cur.rawBody += line + "\n";

      // images: ![alt](src) or <img src="...">  (scoped to <img> so an
      // <audio>/<video> src is not also collected as a picture)
      const imgMd = line.matchAll(/!\[[^\]]*\]\(([^)]*)\)/g);
      for (const im of imgMd) cur.images.push(im[1]);
      const imgSrc = line.matchAll(/<img[^>]*\ssrc=["']([^"']*)["']/gi);
      for (const sm of imgSrc) cur.images.push(sm[1]);

      // audio: [audio: file.mp3] or <audio src="...">
      const audioMd = line.matchAll(/\[audio:\s*([^\]]+\.(?:mp3|wav|ogg|oga|m4a|aac|flac|webm))\]/gi);
      for (const am of audioMd) cur.audios.push(am[1]);
      const audSrc = line.matchAll(/<audio[^>]*\ssrc=["']([^"']*)["']/gi);
      for (const as of audSrc) cur.audios.push(as[1]);

      // video: [video: file.mp4] or <video src="...">
      const vidMd = line.matchAll(/\[video:\s*([^\]]+\.(?:mp4|webm|ogv|ogg|mov|m4v))\]/gi);
      for (const vm of vidMd) cur.videos.push(vm[1]);
      const vidSrc = line.matchAll(/<video[^>]*\ssrc=["']([^"']*)["']/gi);
      for (const vs of vidSrc) cur.videos.push(vs[1]);

      if (/!\[[^\]]*\]\([^)]*\)/.test(line)) continue;

      // matching left-side definition lines: "Definition A: ..." / "Step 1: ...".
      // A line may cram several "Definition X: ..." pairs into one paragraph
      // (a common malformed AI-generated shape) — split all of them out
      // instead of swallowing everything after the first label into one item.
      const defs = extractDefinitions(line);
      if (defs) { defs.forEach(function (d) { cur.leftItems.push(d); }); continue; }

      // option bullets: "- [ ] text" / "- text", and letter-enumerated
      // fallbacks ("A) text", "(A) text", "A. text", "A: text") for banks
      // that skip the dash bullet — otherwise those lines were invisible to
      // the parser and the whole question silently got dropped.
      const optMatch = line.match(/^[-*+]\s*\[\s*[xX]?\s*\]\s*(.+)$/) ||
        line.match(/^[-*+]\s+(\S.*)$/) ||
        line.match(/^\(?([A-Z])[.):]\s+(\S.*)$/);
      if (optMatch) {
        const txt = stripMd(optMatch[2] != null ? optMatch[2] : optMatch[1]);
        if (txt && !/^(definition|step)\s+[a-z0-9]+\s*:/i.test(txt)) cur.options.push(txt);
      }
    }
    pushCur();

    /* ---- attach answers ---- */
    const keyMap = parseAnswerKey(keyText);

    questions.forEach(function (q) {
      const label = "Q" + (q.origId != null ? q.origId : "?");
      q.answerText = keyMap[q.origId] || "";

      const looksMatching =
        /\bmatching\b/i.test(q.question) ||
        (/match the\b/i.test(q.question) && (q.leftItems.length >= 2 || splitAnswerValues(q.answerText, true).length >= 2)) ||
        q.leftItems.length >= 2;

      if (looksMatching) {
        q.type = "matching";
        q.rightItems = q.options.slice();
        q.options = [];
        if (!q.leftItems.length) {
          warnings.push({ qid: q.origId, msg: label + ": matching question has no 'Definition X:' lines — using placeholders." });
          q.leftItems = ["Definition A", "Definition B", "Definition C"];
        }

        // The UI renders one dropdown per definition, populated with every
        // option — a mismatched count means some options never appear (or
        // some definitions get no distinct slot), so this is a hard error,
        // not a cosmetic one.
        if (q.rightItems.length && q.leftItems.length !== q.rightItems.length) {
          warnings.push({
            qid: q.origId,
            severity: "error",
            msg: label + ": " + q.rightItems.length + " option(s) but " + q.leftItems.length +
              " definition(s) parsed — matching needs exactly one option per definition. " +
              "Check that every \"Definition X:\" is on its own line rather than run together in one paragraph."
          });
        }

        const rightDups = findDuplicates(q.rightItems);
        if (rightDups.length) {
          warnings.push({
            qid: q.origId,
            severity: "error",
            msg: label + ": duplicate option text (\"" + rightDups.join("\", \"") + "\") — grading can't tell identical options apart."
          });
        }

        // Grading compares the picked option string to correctAnswers[idx]
        // verbatim, so an answer-key value that doesn't exactly match one of
        // the parsed options will silently never grade correct. Snap to the
        // exact option text on a normalized match; warn otherwise.
        const vals = splitAnswerValues(q.answerText, true);
        const rightNorm = q.rightItems.map(norm);
        let exactCount = 0;
        vals.forEach(function (v, idx) {
          if (idx >= q.leftItems.length) return;
          const ri = rightNorm.indexOf(norm(v));
          if (ri >= 0) {
            q.correctAnswers[idx] = q.rightItems[ri];
            exactCount++;
          } else {
            q.correctAnswers[idx] = v;
            if (q.rightItems.length) {
              warnings.push({
                qid: q.origId,
                msg: label + ": answer \"" + v + "\" (definition " + (idx + 1) + ") doesn't exactly match any parsed option — it will never grade correct."
              });
            }
          }
        });
        if (!Object.keys(q.correctAnswers).length && q.rightItems.length) {
          q.rightItems.forEach(function (item, idx) {
            if (idx < q.leftItems.length) q.correctAnswers[idx] = item;
          });
          warnings.push({ qid: q.origId, msg: label + ": matching answers not found in key — assumed listed order." });
        }
        if (!q.rightItems.length) q.rightItems = uniqueValues(q.correctAnswers);
        if (Object.keys(q.correctAnswers).length < q.leftItems.length) {
          warnings.push({ qid: q.origId, msg: label + ": only " + Object.keys(q.correctAnswers).length + " match(es) for " + q.leftItems.length + " definition(s)." });
        }
        if (q.rightItems.length && q.leftItems.length && !exactCount) {
          warnings.push({
            qid: q.origId,
            severity: "error",
            msg: label + ": none of the answer key values matched a parsed option exactly — every row will grade incorrect."
          });
        }
        return;
      }

      /* single / multiple */
      if (!q.options.length) {
        warnings.push({ qid: q.origId, msg: label + ": no options were parsed — question skipped." });
        q._drop = true;
        return;
      }

      const optDups = findDuplicates(q.options);
      if (optDups.length) {
        warnings.push({
          qid: q.origId,
          severity: "error",
          msg: label + ": duplicate option text (\"" + optDups.join("\", \"") + "\") — grading can't tell identical options apart."
        });
      }

      const values = splitAnswerValues(q.answerText, false);
      const found = new Set();
      const normOpts = q.options.map(norm);
      const normOptSets = normOpts.map(function (no) {
        return new Set(no.split(" ").filter(function (w) { return w && !STOP_WORDS[w]; }));
      });
      const unmatched = [];

      values.forEach(function (v) {
        // 1) letter answers ("B", "c)")
        const li = letterIndex(v);
        if (li >= 0 && li < q.options.length) { found.add(li); return; }
        // 1b) comma/space-separated letters ("A, B, D")
        const parts = String(v).split(/[,\s;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (parts.length > 1 && parts.every(function (p) { return /^[A-Za-z]\)?\.?$/.test(p); })) {
          parts.forEach(function (p) {
            const pi = letterIndex(p);
            if (pi >= 0 && pi < q.options.length) found.add(pi);
          });
          return;
        }
        const nv = norm(v);
        if (!nv) return;
        // 2) exact normalized equality
        let idx = normOpts.indexOf(nv);
        if (idx >= 0) { found.add(idx); return; }
        // 3) containment, either direction — not exact, so flag it
        if (nv.length >= 3) {
          idx = -1;
          for (let i = 0; i < normOpts.length; i++) {
            const no = normOpts[i];
            if (no.length >= 3 && (no.indexOf(nv) !== -1 || nv.indexOf(no) !== -1)) { idx = i; break; }
          }
          if (idx >= 0) {
            found.add(idx);
            warnings.push({ qid: q.origId, msg: label + ": answer \"" + v + "\" matched option \"" + q.options[idx] + "\" only by partial containment — verify the wording matches exactly." });
            return;
          }
        }
        unmatched.push(v);
      });

      // 4) word-overlap fallback for values that matched nothing — also
      //    re-splits stubborn cells on " & " / " and " (e.g. "A & B (options)")
      unmatched.forEach(function (v) {
        // 4a) try comma/space-separated letters first
        const letterParts = String(v).split(/[,\s;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (letterParts.length > 1 && letterParts.every(function (p) { return /^[A-Za-z]\)?\.?$/.test(p); })) {
          letterParts.forEach(function (p) {
            var pi = letterIndex(p);
            if (pi >= 0 && pi < q.options.length) found.add(pi);
          });
          return;
        }
        const frags = String(v).split(/\s+(?:&|and)\s+/i).map(stripMd).filter(Boolean);
        frags.forEach(function (frag) {
          const fw = contentWords(frag);
          if (fw.length < 2) return;
          let best = -1, bestScore = 0.6;
          normOptSets.forEach(function (set, i) {
            const s = overlapScore(fw, set);
            if (s >= bestScore) { if (s > bestScore || best === -1) { best = i; bestScore = s; } }
          });
          if (best >= 0) {
            found.add(best);
            warnings.push({ qid: q.origId, msg: label + ": answer \"" + frag + "\" matched option \"" + q.options[best] + "\" only approximately (fuzzy match) — verify the wording matches exactly." });
          }
        });
      });

      q.correctIndices = Array.from(found).sort(function (a, b) { return a - b; });

      const multiHint = /choose (two|three|2|3)|select (two|three|2|3|all|multiple)|select all that apply|\(choose \d+\)|\(select \d+/i.test(q.question);
      if (q.correctIndices.length > 1 || multiHint) q.type = "multiple"; else q.type = "single";

      if (!q.correctIndices.length) {
        q.correctIndices = [0];
        warnings.push({ qid: q.origId, msg: label + ": could not match the answer key to any option — defaulted to option A." });
      }
    });

    return questions.filter(function (q) { return !q._drop; });
  }

  function uniqueValues(obj) {
    const seen = {};
    const out = [];
    Object.keys(obj).forEach(function (k) {
      const v = obj[k];
      if (!seen[v]) { seen[v] = true; out.push(v); }
    });
    return out;
  }

  /* ---------------- public API ---------------- */
  const Parser = {
    fixMojibake: fixMojibake,
    splitBlocks: splitBlocks,

    /* Full parse: returns { questions, warnings, blocks } with sequential ids */
    parse: function (rawText) {
      const blocks = splitBlocks(rawText || "");
      const warnings = [];
      let all = [];
      blocks.forEach(function (b) { all = all.concat(parseBlock(b, warnings)); });
      all.forEach(function (q, i) { q.id = i + 1; });
      return { questions: all, warnings: warnings, blocks: blocks.length };
    },

    /* Lightweight diagnostics for the importer live preview */
    preview: function (rawText) {
      if (!rawText || !rawText.trim()) return null;
      const r = Parser.parse(rawText);
      const types = { single: 0, multiple: 0, matching: 0 };
      r.questions.forEach(function (q) { types[q.type]++; });
      const errors = r.warnings.filter(function (w) { return w.severity === "error"; });
      const soft = r.warnings.filter(function (w) { return w.severity !== "error"; });
      return {
        blocks: r.blocks,
        total: r.questions.length,
        types: types,
        errors: errors,
        errorCount: errors.length,
        warnings: soft.slice(0, 24),
        warningCount: soft.length
      };
    }
  };

  App.parser = Parser;

  if (typeof module !== "undefined" && module.exports) module.exports = Parser;
})();
