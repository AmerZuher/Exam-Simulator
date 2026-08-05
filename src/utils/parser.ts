// Markdown/JSON exam-bank parser — ported 1:1 from the original vanilla
// app's app/js/parser.js so imported banks parse identically (mojibake
// repair, single/multiple/matching detection, answer-key matching by
// letter/exact/containment/fuzzy overlap).
import type { Question, QuestionType } from '../types/exam';

export interface ParseWarning {
  qid: number | null;
  msg: string;
  severity?: 'error';
}

export type ParsedQuestion = Omit<Question, 'id' | 'exam_id' | 'created_at' | 'updated_at'>;

export interface ParseResult {
  questions: ParsedQuestion[];
  warnings: ParseWarning[];
  blocks: number;
}

export interface ParsedExam {
  name: string;
  questions: ParsedQuestion[];
  warnings: ParseWarning[];
}

// ---------------- mojibake repair ----------------
const MOJI: [RegExp, string][] = [
  [/â€™/g, "'"], [/â€˜/g, "'"], [/â€œ/g, '"'], [/â€/g, '"'], [/â€�/g, '"'],
  [/â€“/g, '–'], [/â€”/g, '—'], [/â€¦/g, '…'], [/â€¢/g, '•'], [/â„¢/g, '™'],
  [/ï¿½|�\?�|�/g, '•'], [/Â(?=\s|$)/g, ''], [/Ã©/g, 'é'], [/Ã¨/g, 'è'],
  [/Ã±/g, 'ñ'], [/Ã¼/g, 'ü'], [/Ã¶/g, 'ö'], [/Ã¤/g, 'ä'], [/Ã§/g, 'ç'],
];

function fixMojibake(str?: string): string {
  if (!str) return '';
  let out = String(str);
  for (const [re, rep] of MOJI) out = out.replace(re, rep);
  return out;
}

// ---------------- helpers ----------------
function stripMd(str?: string): string {
  return String(str || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/__([^_]*)__/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/_([^_]*)_/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function norm(str?: string): string {
  return stripMd(str)
    .toLowerCase()
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const isTableRow = (l: string) => /^\|.*\|$/.test(l.trim());
const isTableSep = (l: string) => /^\|[\s:|-]+\|$/.test(l.trim());
const isFence = (l: string) => /^\s*(```|~~~)/.test(l);

function isQuestionHeading(line: string): boolean {
  return /^#{2,5}\s*\d+\s*[.)]/.test(line.trim());
}

function isAnswerKeyStart(line: string): boolean {
  const l = line.trim();
  if (isQuestionHeading(l)) return false;
  if (/^#{1,6}\s*.*answer\s*key/i.test(l)) return true;
  if (/^\*\*.*answer\s*key.*\*\*$/i.test(l)) return true;
  if (isTableRow(l) && /question/i.test(l) && /answer/i.test(l)) return true;
  return false;
}

function splitBlocks(rawText: string): string[] {
  const lines = String(rawText).split(/\r?\n/);
  const blocks: string[] = [];
  let cur: string[] = [];
  let seenKey = false;
  let inFence = false;

  for (const line of lines) {
    if (isFence(line)) inFence = !inFence;
    else if (!inFence) {
      if (isAnswerKeyStart(line)) seenKey = true;
      if (seenKey && isQuestionHeading(line) && cur.length) {
        blocks.push(cur.join('\n'));
        cur = [];
        seenKey = false;
      }
    }
    cur.push(line);
  }
  if (cur.join('\n').trim()) blocks.push(cur.join('\n'));
  return blocks;
}

function parseAnswerKey(text: string): Record<number, string> {
  const map: Record<number, string> = {};
  const lines = text.split('\n');

  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) return;

    if (isTableRow(line) && !isTableSep(line)) {
      const escaped = line.replace(/\\\|/g, '__PIPE__');
      const cells = escaped.split('|').slice(1, -1).map((c) => c.trim().replace(/__PIPE__/g, '|'));
      if (cells.length >= 2) {
        const first = cells[0].replace(/\*\*/g, '').trim();
        const m = first.match(/(\d+)/);
        if (m && !/question/i.test(first)) {
          const qnum = parseInt(m[1], 10);
          const ans = cells.slice(1).join(' | ').trim();
          if (ans && !/^-+$/.test(ans)) {
            map[qnum] = map[qnum] ? map[qnum] + ' • ' + ans : ans;
          }
        }
      }
      return;
    }

    const lm = line.match(/^[-*]?\s*\**(?:Q(?:uestion)?\s*)?(\d+)\s*[).:\-]\s*\**(.+)/i);
    if (lm) {
      const qnum = parseInt(lm[1], 10);
      const ans = lm[2].trim();
      map[qnum] = map[qnum] ? map[qnum] + ' • ' + ans : ans;
    }
  });

  return map;
}

function splitAnswerValues(raw: string, forMatching: boolean): string[] {
  if (!raw) return [];
  let s = fixMojibake(raw);
  s = s.replace(/<br\s*\/?>/gi, ' • ').replace(/&bull;/g, '•');
  const parts = forMatching ? s.split(/\s*(?:\||,|•)\s*/) : s.split(/\s*(?:•|\|)\s*/);
  return parts.map(stripMd).filter(Boolean);
}

function extractDefinitions(line: string): string[] | null {
  if (!/^(?:Definition|Step)\s+[A-Za-z0-9]+\s*:/i.test(line)) return null;
  const re = /(Definition|Step)\s+([A-Za-z0-9]+)\s*:\s*/gi;
  const marks: { start: number; end: number; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) marks.push({ start: m.index, end: re.lastIndex, label: m[1] + ' ' + m[2] });
  if (!marks.length) return null;
  const out: string[] = [];
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].start : line.length;
    const text = stripMd(line.slice(marks[i].end, end));
    out.push(marks[i].label + ': ' + text);
  }
  return out;
}

function letterIndex(ans: string): number {
  const m = String(ans).trim().match(/^([A-Za-z])\s*[).:]?\s*$/);
  if (!m) return -1;
  const idx = m[1].toUpperCase().charCodeAt(0) - 65;
  return idx >= 0 && idx < 26 ? idx : -1;
}

function findDuplicates(list: string[]): string[] {
  const seen: Record<string, boolean> = {};
  const dups: string[] = [];
  list.forEach((v) => {
    const n = norm(v);
    if (!n) return;
    if (seen[n]) { if (dups.indexOf(v) === -1) dups.push(v); }
    else seen[n] = true;
  });
  return dups;
}

const STOP_WORDS: Record<string, number> = {
  and: 1, or: 1, the: 1, a: 1, an: 1, of: 1, to: 1, in: 1, for: 1, on: 1, with: 1, is: 1, are: 1, by: 1, at: 1, as: 1, vs: 1,
};
function contentWords(s: string): string[] {
  return norm(s).split(' ').filter((w) => w && !STOP_WORDS[w]);
}
function overlapScore(aWords: string[], bSet: Set<string>): number {
  if (!aWords.length || !bSet.size) return 0;
  let hit = 0;
  aWords.forEach((w) => { if (bSet.has(w)) hit++; });
  return hit / aWords.length;
}

function uniqueValues(obj: Record<number, string>): string[] {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  Object.keys(obj).forEach((k) => {
    const v = obj[Number(k)];
    if (!seen[v]) { seen[v] = true; out.push(v); }
  });
  return out;
}

interface WorkingQuestion {
  origId: number | null;
  question: string;
  options: string[];
  images: string[];
  audios: string[];
  videos: string[];
  left_items: string[];
  right_items: string[];
  correct_answers: Record<number, string>;
  correct_indices: number[];
  answerText: string;
  type: QuestionType;
  _drop?: boolean;
}

function parseBlock(text: string, warnings: ParseWarning[]): WorkingQuestion[] {
  const fixed = fixMojibake(text);
  const lines = fixed.split('\n');
  const questions: WorkingQuestion[] = [];
  let cur: WorkingQuestion | null = null;
  let inKey = false;
  let keyText = '';
  let inFence = false;

  function pushCur() { if (cur) { questions.push(cur); cur = null; } }

  for (const raw of lines) {
    const line = raw.trim();

    if (isFence(line)) { inFence = !inFence; continue; }
    if (inFence) continue;

    if (!inKey && isAnswerKeyStart(line)) { inKey = true; keyText += line + '\n'; continue; }
    if (inKey) {
      if (isQuestionHeading(line)) { inKey = false; }
      else { keyText += line + '\n'; continue; }
    }

    if (isQuestionHeading(line)) {
      pushCur();
      const body = line.replace(/^#{2,5}\s*/, '');
      const m = body.match(/^(\d+)\s*[.)]\s*(.*)$/);
      cur = {
        origId: m ? parseInt(m[1], 10) : null,
        question: stripMd(m ? m[2] : body),
        options: [],
        images: [],
        audios: [],
        videos: [],
        left_items: [],
        right_items: [],
        correct_answers: {},
        correct_indices: [],
        answerText: '',
        type: 'single',
      };
      continue;
    }

    if (!cur) continue;

    for (const im of line.matchAll(/!\[[^\]]*\]\(([^)]*)\)/g)) cur.images.push(im[1]);
    for (const sm of line.matchAll(/<img[^>]*\ssrc=["']([^"']*)["']/gi)) cur.images.push(sm[1]);
    for (const am of line.matchAll(/\[audio:\s*([^\]]+\.(?:mp3|wav|ogg|oga|m4a|aac|flac|webm))\]/gi)) cur.audios.push(am[1]);
    for (const as of line.matchAll(/<audio[^>]*\ssrc=["']([^"']*)["']/gi)) cur.audios.push(as[1]);
    for (const vm of line.matchAll(/\[video:\s*([^\]]+\.(?:mp4|webm|ogv|ogg|mov|m4v))\]/gi)) cur.videos.push(vm[1]);
    for (const vs of line.matchAll(/<video[^>]*\ssrc=["']([^"']*)["']/gi)) cur.videos.push(vs[1]);

    if (/!\[[^\]]*\]\([^)]*\)/.test(line)) continue;

    const defs = extractDefinitions(line);
    if (defs) { defs.forEach((d) => cur!.left_items.push(d)); continue; }

    const optMatch =
      line.match(/^[-*+]\s*\[\s*[xX]?\s*\]\s*(.+)$/) ||
      line.match(/^[-*+]\s+(\S.*)$/) ||
      line.match(/^\(?([A-Z])[.):]\s+(\S.*)$/);
    if (optMatch) {
      const txt = stripMd(optMatch[2] != null ? optMatch[2] : optMatch[1]);
      if (txt && !/^(definition|step)\s+[a-z0-9]+\s*:/i.test(txt)) cur.options.push(txt);
    }
  }
  pushCur();

  const keyMap = parseAnswerKey(keyText);

  questions.forEach((q) => {
    const label = 'Q' + (q.origId != null ? q.origId : '?');
    q.answerText = keyMap[q.origId as number] || '';

    const looksMatching =
      /\bmatching\b/i.test(q.question) ||
      (/match the\b/i.test(q.question) && (q.left_items.length >= 2 || splitAnswerValues(q.answerText, true).length >= 2)) ||
      q.left_items.length >= 2;

    if (looksMatching) {
      q.type = 'matching';
      q.right_items = q.options.slice();
      q.options = [];
      if (!q.left_items.length) {
        warnings.push({ qid: q.origId, msg: label + ": matching question has no 'Definition X:' lines — using placeholders." });
        q.left_items = ['Definition A', 'Definition B', 'Definition C'];
      }

      if (q.right_items.length && q.left_items.length !== q.right_items.length) {
        warnings.push({
          qid: q.origId,
          severity: 'error',
          msg: label + ': ' + q.right_items.length + ' option(s) but ' + q.left_items.length +
            ' definition(s) parsed — matching needs exactly one option per definition.',
        });
      }

      const rightDups = findDuplicates(q.right_items);
      if (rightDups.length) {
        warnings.push({
          qid: q.origId,
          severity: 'error',
          msg: label + ': duplicate option text ("' + rightDups.join('", "') + '") — grading can\'t tell identical options apart.',
        });
      }

      const vals = splitAnswerValues(q.answerText, true);
      const rightNorm = q.right_items.map(norm);
      let exactCount = 0;
      vals.forEach((v, idx) => {
        if (idx >= q.left_items.length) return;
        const ri = rightNorm.indexOf(norm(v));
        if (ri >= 0) {
          q.correct_answers[idx] = q.right_items[ri];
          exactCount++;
        } else {
          q.correct_answers[idx] = v;
          if (q.right_items.length) {
            warnings.push({ qid: q.origId, msg: label + ': answer "' + v + '" (definition ' + (idx + 1) + ') doesn\'t exactly match any parsed option.' });
          }
        }
      });
      if (!Object.keys(q.correct_answers).length && q.right_items.length) {
        q.right_items.forEach((item, idx) => { if (idx < q.left_items.length) q.correct_answers[idx] = item; });
        warnings.push({ qid: q.origId, msg: label + ': matching answers not found in key — assumed listed order.' });
      }
      if (!q.right_items.length) q.right_items = uniqueValues(q.correct_answers);
      if (Object.keys(q.correct_answers).length < q.left_items.length) {
        warnings.push({ qid: q.origId, msg: label + ': only ' + Object.keys(q.correct_answers).length + ' match(es) for ' + q.left_items.length + ' definition(s).' });
      }
      if (q.right_items.length && q.left_items.length && !exactCount) {
        warnings.push({ qid: q.origId, severity: 'error', msg: label + ': none of the answer key values matched a parsed option exactly.' });
      }
      return;
    }

    if (!q.options.length) {
      warnings.push({ qid: q.origId, msg: label + ': no options were parsed — question skipped.' });
      q._drop = true;
      return;
    }

    const optDups = findDuplicates(q.options);
    if (optDups.length) {
      warnings.push({ qid: q.origId, severity: 'error', msg: label + ': duplicate option text ("' + optDups.join('", "') + '").' });
    }

    const values = splitAnswerValues(q.answerText, false);
    const found = new Set<number>();
    const normOpts = q.options.map(norm);
    const normOptSets = normOpts.map((no) => new Set(no.split(' ').filter((w) => w && !STOP_WORDS[w])));
    const unmatched: string[] = [];

    values.forEach((v) => {
      const li = letterIndex(v);
      if (li >= 0 && li < q.options.length) { found.add(li); return; }
      const parts = String(v).split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 1 && parts.every((p) => /^[A-Za-z]\)?\.?$/.test(p))) {
        parts.forEach((p) => { const pi = letterIndex(p); if (pi >= 0 && pi < q.options.length) found.add(pi); });
        return;
      }
      const nv = norm(v);
      if (!nv) return;
      let idx = normOpts.indexOf(nv);
      if (idx >= 0) { found.add(idx); return; }
      if (nv.length >= 3) {
        idx = -1;
        for (let i = 0; i < normOpts.length; i++) {
          const no = normOpts[i];
          if (no.length >= 3 && (no.indexOf(nv) !== -1 || nv.indexOf(no) !== -1)) { idx = i; break; }
        }
        if (idx >= 0) {
          found.add(idx);
          warnings.push({ qid: q.origId, msg: label + ': answer "' + v + '" matched option "' + q.options[idx] + '" only by partial containment.' });
          return;
        }
      }
      unmatched.push(v);
    });

    unmatched.forEach((v) => {
      const letterParts = String(v).split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean);
      if (letterParts.length > 1 && letterParts.every((p) => /^[A-Za-z]\)?\.?$/.test(p))) {
        letterParts.forEach((p) => { const pi = letterIndex(p); if (pi >= 0 && pi < q.options.length) found.add(pi); });
        return;
      }
      const frags = String(v).split(/\s+(?:&|and)\s+/i).map(stripMd).filter(Boolean);
      frags.forEach((frag) => {
        const fw = contentWords(frag);
        if (fw.length < 2) return;
        let best = -1, bestScore = 0.6;
        normOptSets.forEach((set, i) => {
          const s = overlapScore(fw, set);
          if (s >= bestScore) { if (s > bestScore || best === -1) { best = i; bestScore = s; } }
        });
        if (best >= 0) {
          found.add(best);
          warnings.push({ qid: q.origId, msg: label + ': answer "' + frag + '" matched option "' + q.options[best] + '" only approximately (fuzzy match).' });
        }
      });
    });

    q.correct_indices = Array.from(found).sort((a, b) => a - b);

    const multiHint = /choose (two|three|2|3)|select (two|three|2|3|all|multiple)|select all that apply|\(choose \d+\)|\(select \d+/i.test(q.question);
    q.type = q.correct_indices.length > 1 || multiHint ? 'multiple' : 'single';

    if (!q.correct_indices.length) {
      q.correct_indices = [0];
      warnings.push({ qid: q.origId, msg: label + ': could not match the answer key to any option — defaulted to option A.' });
    }
  });

  return questions.filter((q) => !q._drop);
}

function toQuestion(w: WorkingQuestion, order: number): ParsedQuestion {
  return {
    order,
    type: w.type,
    question: w.question,
    options: w.options,
    correct_indices: w.correct_indices,
    left_items: w.left_items,
    right_items: w.right_items,
    correct_answers: w.correct_answers,
    images: w.images,
    audios: w.audios,
    videos: w.videos,
  };
}

export function parseMarkdown(rawText: string): ParseResult {
  const blocks = splitBlocks(rawText || '');
  const warnings: ParseWarning[] = [];
  let all: WorkingQuestion[] = [];
  blocks.forEach((b) => { all = all.concat(parseBlock(b, warnings)); });
  return {
    questions: all.map((q, i) => toQuestion(q, i)),
    warnings,
    blocks: blocks.length,
  };
}

export interface ParsePreview {
  blocks: number;
  total: number;
  types: Record<QuestionType, number>;
  errors: ParseWarning[];
  errorCount: number;
  warnings: ParseWarning[];
  warningCount: number;
}

export function previewMarkdown(rawText: string): ParsePreview | null {
  if (!rawText || !rawText.trim()) return null;
  const r = parseMarkdown(rawText);
  const types: Record<QuestionType, number> = { single: 0, multiple: 0, matching: 0 };
  r.questions.forEach((q) => { types[q.type]++; });
  const errors = r.warnings.filter((w) => w.severity === 'error');
  const soft = r.warnings.filter((w) => w.severity !== 'error');
  return {
    blocks: r.blocks,
    total: r.questions.length,
    types,
    errors,
    errorCount: errors.length,
    warnings: soft.slice(0, 24),
    warningCount: soft.length,
  };
}

// ---------------- JSON bank parsing ----------------
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

function normalizeJsonQuestion(raw: any, order: number): ParsedQuestion {
  const options: string[] = Array.isArray(raw.options) ? raw.options.map(String) : [];
  const left_items: string[] = Array.isArray(raw.leftItems) ? raw.leftItems.map(String) : [];
  const right_items: string[] = Array.isArray(raw.rightItems) ? raw.rightItems.map(String) : [];
  const correct_answers: Record<number, string> = raw.correctAnswers && typeof raw.correctAnswers === 'object' ? raw.correctAnswers : {};
  let correct_indices: number[] = Array.isArray(raw.correctIndices)
    ? raw.correctIndices.map(Number).filter((n: number) => n >= 0 && n < options.length)
    : [];

  let type: QuestionType = raw.type;
  if (type !== 'single' && type !== 'multiple' && type !== 'matching') {
    type = left_items.length ? 'matching' : correct_indices.length > 1 ? 'multiple' : 'single';
  }
  if (type !== 'matching' && !correct_indices.length && options.length) correct_indices = [0];

  const out: ParsedQuestion = {
    order,
    question: String(raw.question == null ? '' : raw.question).trim(),
    type,
    options,
    correct_indices,
    left_items,
    right_items: right_items.length || type !== 'matching' ? right_items : options.slice(),
    correct_answers,
    images: Array.isArray(raw.images) ? raw.images.map(String) : [],
    audios: Array.isArray(raw.audios) ? raw.audios.map(String) : [],
    videos: Array.isArray(raw.videos) ? raw.videos.map(String) : [],
  };

  if (raw.difficulty != null && String(raw.difficulty).trim()) {
    const rawDiff = String(raw.difficulty).trim();
    const known = DIFFICULTIES.find((d) => d.toLowerCase() === rawDiff.toLowerCase());
    out.difficulty = known || rawDiff;
  }

  if (raw.explanation && typeof raw.explanation === 'object' && !Array.isArray(raw.explanation)) {
    const correct = typeof raw.explanation.correct === 'string' ? raw.explanation.correct.trim() : '';
    const incorrect = Array.isArray(raw.explanation.incorrect) ? raw.explanation.incorrect.map(String).filter(Boolean) : [];
    if (correct || incorrect.length) {
      out.explanation = {};
      if (correct) out.explanation.correct = correct;
      if (incorrect.length) out.explanation.incorrect = incorrect;
    }
  }

  return out;
}

export function parseJson(text: string): ParsedExam {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("That isn't valid JSON — " + (e instanceof Error ? e.message : String(e)));
  }
  const rawList = Array.isArray(data) ? data : data && data.questions;
  if (!Array.isArray(rawList)) {
    throw new Error('Expected an array of questions, or an object with a "questions" array.');
  }
  if (!rawList.length) throw new Error('The questions array is empty.');

  const warnings: ParseWarning[] = [];
  const questions: ParsedQuestion[] = [];

  rawList.forEach((raw: any, i: number) => {
    const q = normalizeJsonQuestion(raw, questions.length);
    const label = 'Q' + (i + 1);
    if (!q.question) { warnings.push({ qid: null, msg: label + ': no question text — skipped.' }); return; }

    if (q.type === 'matching') {
      if (!q.left_items.length) { warnings.push({ qid: null, msg: label + ': matching question has no leftItems — skipped.' }); return; }
    } else if (q.options.length < 2) {
      warnings.push({ qid: null, msg: label + ': fewer than two options — skipped.' });
      return;
    }
    questions.push(q);
  });

  if (!questions.length) throw new Error('No usable questions found in that JSON.');

  return {
    name: !Array.isArray(data) && data.name ? String(data.name) : '',
    questions,
    warnings,
  };
}

export function searchQuestions(questions: Question[], query: string): Question[] {
  const term = query.toLowerCase();
  return questions.filter((q) => {
    const hay = (q.question + ' ' + q.options.join(' ') + ' ' + q.left_items.join(' ') + ' ' + q.right_items.join(' ')).toLowerCase();
    return hay.includes(term);
  });
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
