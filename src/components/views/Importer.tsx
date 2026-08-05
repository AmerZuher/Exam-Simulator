import { useMemo, useRef, useState } from 'react';
import { useExams } from '../../hooks/useExams';
import { useGroups } from '../../hooks/useGroups';
import { useDialog } from '../../hooks/useDialog';
import { useLookPicker } from '../../hooks/useLookPicker';
import { useToast } from '../../hooks/useToast';
import { examsService } from '../../services/examsService';
import { parseMarkdown, parseJson, previewMarkdown, ParsedQuestion, ParseWarning } from '../../utils/parser';
import { Icon, IconName } from '../../utils/icons';
import { Select } from '../ui/Select';
import type { Exam } from '../../types/exam';

interface ImporterProps {
  // Passes the freshly created exam itself, not just its id — the caller
  // needs the name immediately (e.g. to route to it), and the shared exams
  // list won't have re-rendered with this new row yet at the point this
  // fires (state update is still in flight one microtask behind).
  onImported: (exam: Exam) => void;
  onCancel: () => void;
  onGenerator?: () => void;
}

type Format = 'markdown' | 'json';

interface Look {
  icon: IconName | null;
  tone: string;
  logo: string | null;
}

function sniffFormat(text: string): Format | null {
  const t = text.trim();
  if (!t) return null;
  if (/^[{[]/.test(t)) return 'json';
  if (/^#{2,5}\s*\d+\s*[.)]/m.test(t)) return 'markdown';
  return null;
}

function extractMdTitle(text: string): string {
  const firstLine = (text || '').trim().split(/\r?\n/, 1)[0] || '';
  const m = /^#\s+(.+)$/.exec(firstLine.trim());
  return m ? m[1].trim() : '';
}

export function Importer({ onImported, onCancel, onGenerator }: ImporterProps) {
  const { exams, createExam } = useExams();
  const { groups, createGroup } = useGroups();
  const { prompt } = useDialog();
  const { pickLook } = useLookPicker();
  const toast = useToast();

  const [format, setFormat] = useState<Format>('markdown');
  const [raw, setRaw] = useState('');
  const [name, setName] = useState('');
  const [lastAutoTitle, setLastAutoTitle] = useState('');
  const [groupId, setGroupId] = useState('');
  const [look, setLook] = useState<Look>({ icon: 'grad', tone: 'acc', logo: null });
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    if (!raw.trim()) return null;
    if (format === 'json') {
      try {
        const result = parseJson(raw);
        return {
          questions: result.questions as ParsedQuestion[],
          warnings: result.warnings as ParseWarning[],
          errorCount: 0,
          suggestedName: result.name,
          types: countTypes(result.questions),
          fatal: null as string | null,
        };
      } catch (e) {
        return { questions: [] as ParsedQuestion[], warnings: [] as ParseWarning[], errorCount: 0, suggestedName: '', types: { single: 0, multiple: 0, matching: 0 }, fatal: e instanceof Error ? e.message : String(e) };
      }
    }
    const preview = previewMarkdown(raw);
    if (!preview) return null;
    const full = parseMarkdown(raw);
    return {
      questions: full.questions,
      warnings: preview.warnings,
      errorCount: preview.errorCount,
      suggestedName: '',
      types: preview.types,
      fatal: preview.errorCount ? `${preview.errorCount} error(s) must be fixed before this bank can be imported.` : null,
    };
  }, [raw, format]);

  function countTypes(questions: ParsedQuestion[]) {
    const t = { single: 0, multiple: 0, matching: 0 };
    questions.forEach((q) => { t[q.type]++; });
    return t;
  }

  const applyAutoTitle = (extracted: string) => {
    if (!extracted) return;
    if (!name.trim() || name === lastAutoTitle) {
      setName(extracted);
      setLastAutoTitle(extracted);
    }
  };

  const loadText = (text: string, suggestedFormat: Format, fileTitle?: string) => {
    setRaw(text);
    setFormat(suggestedFormat);
    if (fileTitle) { setName(fileTitle); setLastAutoTitle(fileTitle); }
  };

  const handleFile = (file: File) => {
    const isJson = /\.json$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      let title = file.name.replace(/\.[^.]+$/, '');
      if (isJson) {
        try {
          const probe = JSON.parse(text);
          if (probe && !Array.isArray(probe) && probe.name) title = String(probe.name);
        } catch {
          // diagnostics below will report the parse error
        }
      } else {
        const mdTitle = extractMdTitle(text);
        if (mdTitle) title = mdTitle;
      }
      loadText(text, isJson ? 'json' : 'markdown', title);
      toast('File loaded — review the diagnostics below.', 'info');
    };
    reader.readAsText(file);
  };

  const handleRawChange = (text: string) => {
    setRaw(text);
    const sniffed = sniffFormat(text);
    if (sniffed && sniffed !== format) setFormat(sniffed);
    if (sniffed === 'json') {
      try {
        const data = JSON.parse(text);
        if (data && !Array.isArray(data) && data.name) applyAutoTitle(String(data.name));
      } catch {
        // ignore — parse errors surface in diagnostics
      }
    } else {
      applyAutoTitle(extractMdTitle(text));
    }
  };

  const handleNewGroup = async () => {
    const v = await prompt({ title: 'New exam group', desc: 'Give this group a name — e.g. a certification track.', placeholder: 'Group name', confirmLabel: 'Create' });
    if (!v) return;
    const g = await createGroup(v);
    setGroupId(g.id);
    toast(`Group "${v}" created and selected.`, 'ok');
  };

  const handlePickLook = async () => {
    const result = await pickLook({
      title: 'Bank icon', subtitle: name.trim() || 'New bank',
      icon: look.icon || 'grad', tone: look.tone as any, logo: look.logo,
    });
    if (!result) return;
    setLook({ icon: result.icon, tone: result.tone, logo: result.logo });
  };

  const copyIssuesForAI = () => {
    if (!parsed) return;
    const errors = parsed.warnings.filter((w) => w.severity === 'error');
    const soft = parsed.warnings.filter((w) => w.severity !== 'error');
    const lines = [
      "The exam file you generated has formatting problems that ExamPro's importer caught — please fix these in the source and resend the corrected file. Don't change question content, only the formatting issues listed below.",
      '',
    ];
    if (errors.length) {
      lines.push('BLOCKING ERRORS (the bank can\'t be imported until these are fixed):');
      errors.forEach((w, i) => lines.push(`${i + 1}. ${w.msg}`));
      lines.push('');
    }
    if (soft.length) {
      lines.push('WARNINGS (importable, but double-check these):');
      soft.forEach((w, i) => lines.push(`${i + 1}. ${w.msg}`));
      lines.push('');
    }
    lines.push('Formatting reference: question headings are "### N. Question text", options are "- [ ] Choice", matching definitions are one "Definition X: text" per line with exactly one option per definition, and the answer key is a "| Question Number | Correct Answer |" table.');
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => toast('Diagnostics copied — paste them to the AI that generated this exam to get a corrected file.', 'ok'),
      () => toast('Copy failed — select and copy manually.', 'err')
    );
  };

  const canImport = !!parsed && parsed.questions.length > 0 && !parsed.fatal && name.trim().length > 0 && !importing;

  const handleImport = async () => {
    if (!parsed || !parsed.questions.length) return;
    const finalTitle = name.trim() || parsed.suggestedName;
    if (!finalTitle) { toast('Give the new bank a name.', 'err'); return; }
    if (exams.some((e) => e.name.trim().toLowerCase() === finalTitle.toLowerCase())) {
      toast(`You already have a bank named "${finalTitle}" — pick a different name.`, 'err');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const exam = await createExam(finalTitle, {
        icon: look.logo ? undefined : look.icon || undefined,
        color: look.tone,
        group_id: groupId || null,
      });
      await examsService.createQuestions(parsed.questions.map((q) => ({ ...q, exam_id: exam.id })));
      const groupName = groups.find((g) => g.id === groupId)?.name;
      toast(`Bank "${finalTitle}" created with ${parsed.questions.length} questions.${groupName ? ` Added to "${groupName}".` : ''}`, 'ok');
      onImported(exam);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const hint = format === 'json'
    ? 'Either a bare array of questions or { "name", "questions": [...] } — the shape produced by Export as JSON.'
    : 'Question headings look like "### 1. Your question", options like "- [ ] Choice", and an answer key table at the end.';

  return (
    <div className="view" style={{ maxWidth: 860, margin: '0 auto' }}>
      <section className="card card-pad rise">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>Import question bank</h2>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>
                Drop a markdown file onto this page, paste raw markdown below, or import a previously exported JSON bank.
              </p>
            </div>
            {onGenerator && (
              <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={onGenerator}>
                <Icon name="robot" size={14} />AI Exam Generator
              </button>
            )}
          </div>

          <div
            className={`dropzone${dragging ? ' drag' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <div className="dz-ico"><Icon name="upload" size={21} /></div>
            <div>
              <div className="dz-t">Drag &amp; drop your file here</div>
              <div className="dz-s">.md / .txt markdown banks · .json exports · or click to browse</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.txt,.json"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="set-grid">
            <div>
              <label className="field-lbl">Bank name &amp; icon</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span
                  className={`bank-badge editable${look.logo ? ' has-img' : ` tone-${look.tone}`}`}
                  role="button"
                  tabIndex={0}
                  title="Choose icon or upload a logo"
                  onClick={handlePickLook}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePickLook(); } }}
                >
                  {look.logo ? <img className="bank-badge-img" src={look.logo} alt="" /> : <Icon name={look.icon || 'grad'} size={20} />}
                </span>
                <input
                  className="input"
                  placeholder="e.g. PMP Practice Set 1"
                  maxLength={70}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <div>
              <label className="field-lbl">Add to Exam Group</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <Select
                    value={groupId}
                    onChange={setGroupId}
                    options={[{ value: '', label: 'No group (ungrouped)' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
                  />
                </div>
                <button type="button" className="btn btn-ghost" style={{ flexShrink: 0 }} onClick={handleNewGroup}>
                  <Icon name="layers" size={14} />New group
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="field-lbl">Content</label>
            <div className="import-content-wrap">
              <textarea
                className={`textarea${format === 'json' ? ' mono' : ''}`}
                rows={11}
                value={raw}
                onChange={(e) => handleRawChange(e.target.value)}
                placeholder={format === 'json'
                  ? '{\n  "name": "My bank",\n  "questions": [\n    {\n      "question": "Capital of France?",\n      "type": "single",\n      "options": ["London", "Paris"],\n      "correctIndices": [1]\n    }\n  ]\n}'
                  : '# My bank\n\n### 1. Your first question\n- [ ] Option A\n- [ ] Option B\n...\n### Answer Key\n| Question Number | Correct Answer |\n| 1 | Option B |'}
              />
              <span className={`chip import-fmt-badge ${format === 'json' ? 'chip-teal' : 'chip-acc'}`}>
                <Icon name={format === 'json' ? 'code' : 'book'} size={11} strokeWidth={2.2} />
                {format === 'json' ? 'JSON' : 'Markdown'}
              </span>
            </div>
            <div className="field-hint">{hint}</div>
          </div>

          {parsed && (
            <div>
              {parsed.fatal && !parsed.errorCount ? (
                <div className="warn-item" style={{ color: 'var(--bad)', background: 'var(--bad-soft)', borderColor: 'var(--bad-line)' }}>
                  <Icon name="warn" size={13} strokeWidth={2.2} /><span>{parsed.fatal}</span>
                </div>
              ) : (
                <>
                  <div className="diag">
                    <div className="diag-tile"><div className="dt-n">{parsed.questions.length}</div><div className="dt-l">Questions parsed</div></div>
                    <div className="diag-tile"><div className="dt-n" style={{ fontSize: 13, lineHeight: 2 }}>{parsed.types.single} single · {parsed.types.multiple} multi · {parsed.types.matching} match</div><div className="dt-l">Type breakdown</div></div>
                    <div className="diag-tile"><div className="dt-n">{parsed.warnings.length}</div><div className="dt-l">Warnings</div></div>
                  </div>

                  {(parsed.errorCount > 0 || parsed.warnings.length > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
                      <button className="linklike" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--acc)', fontSize: 11.5, fontWeight: 700 }} onClick={copyIssuesForAI}>
                        <Icon name="robot" size={13} />Copy issues for AI
                      </button>
                    </div>
                  )}

                  {parsed.warnings.length > 0 ? (
                    <div className="warn-list">
                      {parsed.warnings.slice(0, 24).map((w, i) => (
                        <div key={i} className="warn-item" style={w.severity === 'error' ? { color: 'var(--bad)', background: 'var(--bad-soft)', borderColor: 'var(--bad-line)' } : undefined}>
                          <Icon name="warn" size={13} strokeWidth={2.2} /><span>{w.msg}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="warn-item" style={{ color: 'var(--ok)', background: 'var(--ok-soft)', borderColor: 'var(--ok-line)' }}>
                      <Icon name="check" size={13} strokeWidth={2.4} /><span>Clean parse — every answer key matched its options.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <div className="warn-item" style={{ color: 'var(--bad)', background: 'var(--bad-soft)', borderColor: 'var(--bad-line)' }}>
              <Icon name="warn" size={13} strokeWidth={2.2} /><span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" disabled={!canImport} onClick={handleImport} title={parsed?.errorCount ? `Fix ${parsed.errorCount} error(s) above before importing.` : ''}>
              <Icon name="check" size={15} />{importing ? 'Importing…' : 'Parse & save bank'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
