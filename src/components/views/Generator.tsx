import { useEffect, useRef, useState } from 'react';
import { useGroups } from '../../hooks/useGroups';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../../utils/icons';

interface GeneratorProps {
  onImport: () => void;
}

type SourceTab = 'paste' | 'upload';
type OutputFormat = 'md' | 'json';
type TypeKey = 'single' | 'multiple' | 'matching' | 'tf';

interface MockQuestion {
  question: string;
  options: string[];
  correctIndices: number[];
  type: string;
  difficulty: string;
  confidence: number;
  explanation: { correct: string; incorrect: string[] };
}

const MOCK_QUESTIONS: MockQuestion[] = [
  {
    question: 'Which HTTP status code indicates that a request succeeded?',
    options: ['200 OK', '301 Moved Permanently', '404 Not Found', '500 Internal Server Error'],
    correctIndices: [0],
    type: 'single',
    difficulty: 'Easy',
    confidence: 94,
    explanation: {
      correct: '200 OK is the standard response for a successful HTTP request.',
      incorrect: ["301 is a redirect, not a success status.", "404 means the resource wasn't found.", '500 indicates a server-side error.'],
    },
  },
  {
    question: "Select all statements that are true of JavaScript's const declarations. (Select all that apply)",
    options: ['The binding cannot be reassigned', 'The value is always deeply immutable', 'It is block-scoped', 'It must be initialized at declaration'],
    correctIndices: [0, 2, 3],
    type: 'multiple',
    difficulty: 'Medium',
    confidence: 88,
    explanation: {
      correct: 'const prevents reassigning the binding, is block-scoped, and requires an initializer.',
      incorrect: ['Objects/arrays declared with const can still be mutated internally — only the binding itself is fixed.'],
    },
  },
];

const LOADING_PHASES = ['Reading your source content…', 'Drafting candidate questions…', 'Balancing difficulty & checking duplicates…'];

function BetaBadge() {
  return <span className="beta-badge">Beta</span>;
}

function clampCount(v: number): number {
  if (isNaN(v)) return 20;
  return Math.max(1, Math.min(50, v));
}

function typeList(types: Record<TypeKey, boolean>): string[] {
  const list: string[] = [];
  if (types.single) list.push('Single Choice');
  if (types.multiple) list.push('Multiple Choice');
  if (types.matching) list.push('Matching');
  if (types.tf) list.push('True/False (formatted as single-choice with exactly two options: True and False)');
  return list.length ? list : ['Single Choice'];
}

function schemaExample(includeExplanation: boolean, includeIncorrect: boolean, includeDifficulty: boolean) {
  const q: any = {
    question: 'Question text',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndices: [0],
    type: 'single',
  };
  if (includeExplanation) {
    q.explanation = includeIncorrect
      ? { correct: 'Why the correct answer is correct.', incorrect: ['Why option A is incorrect.', 'Why option B is incorrect.', 'Why option C is incorrect.', 'Why option D is incorrect.'] }
      : { correct: 'Why the correct answer is correct.' };
  }
  if (includeDifficulty) q.difficulty = 'Medium';
  return { questions: [q] };
}

function buildPrompt(
  sourceText: string, count: number, outputFormat: OutputFormat, types: Record<TypeKey, boolean>,
  includeDifficulty: boolean, includeExplanation: boolean, includeIncorrect: boolean
): string {
  const list = typeList(types);
  const lines: string[] = [];

  if (outputFormat === 'json') {
    lines.push(
      'Please generate an exam as a single JSON object based on the reference material I provide below.', '',
      'Follow these rules exactly:', '',
      `1. **Question count:** Generate exactly ${count} questions.`,
      `2. **Question types:** Use a mix of: ${list.join(', ')}. Mix them in random order — do not group by type or add section headers.`,
      '3. **Output shape:** Return ONLY a JSON object of this exact shape (no markdown fences, no commentary):', '',
      JSON.stringify(schemaExample(includeExplanation, includeIncorrect, includeDifficulty), null, 2), '',
      '4. **type:** one of "single", "multiple", or "matching". Treat True/False as "single" with options ["True","False"].',
      '5. **correctIndices:** zero-based indices into "options" that are correct.'
    );
    lines.push(includeDifficulty
      ? '6. **difficulty:** include a "difficulty" field on every question — one of "Easy", "Medium", or "Hard".'
      : '6. Do NOT include a "difficulty" field.');
    lines.push(includeExplanation
      ? `7. **explanation:** include an "explanation" object per question with a "correct" string${includeIncorrect ? ' and an "incorrect" array of strings, one per wrong option, explaining why it\'s wrong.' : '. Do not include an "incorrect" array.'}`
      : '7. Do NOT include an "explanation" field.');
    lines.push('', 'Here is the reference material to base the exam on:', sourceText || '[PASTE YOUR CONTENT HERE]');
  } else {
    lines.push(
      'Please create an exam based on the content I provide you below.', '',
      'Follow these strict formatting and content rules:', '',
      `1. **Question Types:** Create a mix of ${list.join(', ')}.`,
      `2. **Question Count:** Create exactly ${count} questions.`,
      `3. **No Sections:** Do not group the questions by type or create section headers. Mix the question types up and number them sequentially from 1 to ${count}.`,
      '4. **Question Headings:** Format the heading for EVERY question exactly like this: ### 1. [Question Text]',
      '5. **Options Format:** Use - [ ] for all options instead of A), B), C), etc.',
      'Example:', '### 1. What is the capital of France?', '- [ ] London', '- [ ] Paris', '- [ ] Berlin'
    );
    if (types.matching) {
      lines.push(
        '6. **Matching Questions:** For matching questions, format them like this:',
        '### 5. Matching: Match the definitions with the correct items.',
        '- [ ] Option1', '- [ ] Option2', '- [ ] Option3',
        'Definition A: Description of first item', 'Definition B: Description of second item', 'Definition C: Description of third item',
        '   - The number of - [ ] options MUST equal the number of definitions.',
        '   - Each definition MUST start with "Definition X:" where X is A, B, C, etc.'
      );
    }
    const n = types.matching ? 7 : 6;
    lines.push(
      `${n}. **Answer Key Table:** After all ${count} questions, provide the Answer Key in a single Markdown table at the very bottom. Use exactly this table format:`,
      '| Question Number | Correct Answer |', '| :-------------- | :------------- |', '| 1               | Paris          |',
      `${n + 1}. **Multi-Choice Answers in Table:** format the correct answers using bullet points and <br> tags for line breaks. Example:`,
      '| 2               | • Option 1  <br>• Option 3 |'
    );
    if (types.matching) {
      lines.push(`${n + 2}. **Matching Question Answers in Table:** list the options in the same order as the definitions, separated by commas, e.g. "Option1, Option2, Option3". Do NOT use the | character as a separator.`);
    }
    if (includeDifficulty) {
      lines.push('Also add a line directly under each question\'s options reading exactly "Difficulty: Easy" (or Medium / Hard). Note: today\'s Markdown importer does not parse this line automatically — it\'s for your own reference when reviewing the generated exam.');
    }
    if (includeExplanation) {
      lines.push(`Also add a line reading "Explanation: ..." explaining why the correct answer is correct${includeIncorrect ? ', followed by one "Why not <option>: ..." line per incorrect option' : ''}. Note: today's Markdown importer does not parse this automatically either — it's for your own reference.`);
    }
    lines.push('', 'Here is the content to base the exam on:', sourceText || '[PASTE YOUR CONTENT HERE]');
  }

  return lines.join('\n');
}

function QuestionCard({ q, includeDifficulty, includeExplanation, includeIncorrect }: {
  q: MockQuestion; includeDifficulty: boolean; includeExplanation: boolean; includeIncorrect: boolean;
}) {
  const diffTone = q.difficulty === 'Easy' ? 'ok' : q.difficulty === 'Medium' ? 'warn' : 'bad';
  return (
    <div className="gen-qcard">
      <div className="gen-qcard-badges">
        <span className="confidence-badge"><Icon name="sparkle" size={11} strokeWidth={2.4} />{q.confidence}% confidence</span>
        {includeDifficulty && <span className={`chip chip-${diffTone}`}>{q.difficulty}</span>}
      </div>
      <div className="gen-qcard-q">{q.question}</div>
      <ul className="gen-opt-list">
        {q.options.map((opt, i) => {
          const correct = q.correctIndices.includes(i);
          return (
            <li key={i} className={`gen-opt${correct ? ' correct' : ''}`}>
              {correct ? <Icon name="check" size={13} strokeWidth={3} /> : <span className="gen-opt-dot" />}
              <span>{opt}</span>
            </li>
          );
        })}
      </ul>
      {includeExplanation && (
        <div className="gen-explanation">
          <b>Why:</b> {q.explanation.correct}
          {includeIncorrect && (
            <ul>{q.explanation.incorrect.map((t, i) => <li key={i}>{t}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Generator({ onImport }: GeneratorProps) {
  const { groups } = useGroups();
  const toast = useToast();

  const [sourceTab, setSourceTab] = useState<SourceTab>('paste');
  const [sourceText, setSourceText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('json');
  const [types, setTypes] = useState<Record<TypeKey, boolean>>({ single: true, multiple: true, matching: true, tf: true });
  const [count, setCount] = useState(20);
  const [includeDifficulty, setIncludeDifficulty] = useState(false);
  const [dist, setDist] = useState({ easy: 34, medium: 33, hard: 33 });
  const [includeExplanation, setIncludeExplanation] = useState(false);
  const [includeIncorrect, setIncludeIncorrect] = useState(false);
  const [genStep, setGenStep] = useState<number | null>(null);
  const [generatedResult, setGeneratedResult] = useState<MockQuestion[] | null>(null);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (genTimerRef.current) clearInterval(genTimerRef.current); }, []);

  const validateTypes = (): boolean => {
    if (!types.single && !types.multiple && !types.matching && !types.tf) {
      toast('Select at least one question type.', 'err');
      return false;
    }
    return true;
  };

  const handleCopyPrompt = () => {
    if (!validateTypes()) return;
    const prompt = buildPrompt(sourceText, clampCount(count), outputFormat, types, includeDifficulty, includeExplanation, includeIncorrect);
    navigator.clipboard?.writeText(prompt).then(
      () => toast('AI prompt copied to clipboard.', 'ok'),
      () => toast('Copy failed — select and copy manually.', 'err')
    );
  };

  const handleGenerate = () => {
    if (!validateTypes()) return;
    if (genTimerRef.current) clearInterval(genTimerRef.current);
    setGeneratedResult(null);
    setGenStep(0);
    let step = 0;
    genTimerRef.current = setInterval(() => {
      step++;
      if (step >= LOADING_PHASES.length) {
        if (genTimerRef.current) clearInterval(genTimerRef.current);
        genTimerRef.current = null;
        setGenStep(null);
        setGeneratedResult(MOCK_QUESTIONS);
      } else {
        setGenStep(step);
      }
    }, 800);
  };

  const suggestedGroup = groups.length ? groups[0].name : 'General Studies';

  return (
    <div className="view" style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* ---- source content ---- */}
      <section className="card card-pad rise settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div className="set-head" style={{ marginBottom: 18 }}>
            <div className="set-ico"><Icon name="edit" size={17} /></div>
            <div><h3>Source content</h3><p>Optional — paste reference material to ground the exam, or leave it blank and still get a usable prompt template.</p></div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onImport} style={{ flexShrink: 0 }}><Icon name="upload" size={14} />Open Import</button>
        </div>
        <div className="seg-tabs">
          <button type="button" className={`seg-tab${sourceTab === 'paste' ? ' on' : ''}`} onClick={() => setSourceTab('paste')}><Icon name="edit" size={13} />Paste content</button>
          <button type="button" className={`seg-tab${sourceTab === 'upload' ? ' on' : ''}`} onClick={() => setSourceTab('upload')}><Icon name="upload" size={13} />Upload document<BetaBadge /></button>
        </div>

        {sourceTab === 'paste' ? (
          <div style={{ marginTop: 14 }}>
            <textarea
              className="textarea"
              rows={7}
              placeholder="Paste your reference material, notes, or existing content here… (optional)"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <div
              className={`dropzone${dragging ? ' drag' : ''}`}
              onClick={() => uploadFileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setUploadedFileName(f.name); }}
            >
              <div className="dz-ico"><Icon name="upload" size={21} /></div>
              <div>
                <div className="dz-t">Drag &amp; drop a PDF / DOCX / TXT here</div>
                <div className="dz-s">or click to browse · <BetaBadge /> parsing is illustrative only — nothing is actually read from the file yet.</div>
              </div>
            </div>
            <input
              ref={uploadFileRef}
              type="file"
              accept=".pdf,.docx,.txt"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadedFileName(f.name); e.target.value = ''; }}
            />
            {uploadedFileName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span className="chip chip-mut"><Icon name="book" size={11} strokeWidth={2.2} />{uploadedFileName}</span>
                <button className="icon-btn" aria-label="Remove file" onClick={() => setUploadedFileName(null)}><Icon name="x" size={13} /></button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---- exam settings ---- */}
      <section className="card card-pad rise settings-card" style={{ animationDelay: '.05s' }}>
        <div className="set-head">
          <div className="set-ico"><Icon name="layers" size={17} /></div>
          <div><h3>Exam settings</h3><p>Format, size, and the mix of question types to generate.</p></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }} className="set-grid">
          <div>
            <label className="field-lbl">Output format</label>
            <div className="seg-tabs">
              <button type="button" className={`seg-tab${outputFormat === 'md' ? ' on' : ''}`} onClick={() => setOutputFormat('md')}><Icon name="book" size={13} />Markdown</button>
              <button type="button" className={`seg-tab${outputFormat === 'json' ? ' on' : ''}`} onClick={() => setOutputFormat('json')}><Icon name="code" size={13} />JSON</button>
            </div>
          </div>
          <div>
            <label className="field-lbl">Number of questions</label>
            <div className="stepper">
              <button type="button" className="icon-btn" aria-label="Decrease" onClick={() => setCount((c) => clampCount(c - 1))}><Icon name="chevL" size={14} /></button>
              <input type="number" className="input" min={1} max={50} value={count} onChange={(e) => setCount(clampCount(parseInt(e.target.value, 10)))} />
              <button type="button" className="icon-btn" aria-label="Increase" onClick={() => setCount((c) => clampCount(c + 1))}><Icon name="chevR" size={14} /></button>
            </div>
            <div className="field-hint">50 is the maximum for now.</div>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label className="field-lbl">Question types to include</label>
            <div className="seg-tabs" style={{ flexWrap: 'wrap' }}>
              <button type="button" className={`seg-tab${types.single ? ' on' : ''}`} onClick={() => setTypes((t) => ({ ...t, single: !t.single }))}>Single choice</button>
              <button type="button" className={`seg-tab${types.multiple ? ' on' : ''}`} onClick={() => setTypes((t) => ({ ...t, multiple: !t.multiple }))}>Multiple choice</button>
              <button type="button" className={`seg-tab${types.matching ? ' on' : ''}`} onClick={() => setTypes((t) => ({ ...t, matching: !t.matching }))}>Matching</button>
              <button type="button" className={`seg-tab${types.tf ? ' on' : ''}`} onClick={() => setTypes((t) => ({ ...t, tf: !t.tf }))}>True/False</button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- question details ---- */}
      <section className="card card-pad rise settings-card" style={{ animationDelay: '.1s' }}>
        <div className="set-head">
          <div className="set-ico"><Icon name="brain" size={17} /></div>
          <div><h3>Question details</h3><p>Optional extras to include on every generated question.</p></div>
        </div>
        <div className="switch-row">
          <div><div className="sr-txt">Difficulty rating</div><div className="sr-sub">Adds Easy / Medium / Hard to each question.</div></div>
          <label className="switch">
            <input type="checkbox" checked={includeDifficulty} onChange={(e) => setIncludeDifficulty(e.target.checked)} />
            <span className="track" /><span className="thumb" />
          </label>
        </div>
        {includeDifficulty && (
          <div style={{ marginTop: 12 }}>
            <div className="dist-widget">
              <div className="dist-label"><BetaBadge /> <span>Target difficulty spread — approximate, for preview only</span></div>
              {(['easy', 'medium', 'hard'] as const).map((k) => {
                const label = k.charAt(0).toUpperCase() + k.slice(1);
                const tone = k === 'easy' ? 'ok' : k === 'medium' ? 'warn' : 'bad';
                return (
                  <div key={k}>
                    <div className="dist-row">
                      <span className="dist-row-lbl">{label}</span>
                      <input
                        type="range" min={0} max={100} value={dist[k]} className="dist-slider"
                        onChange={(e) => setDist((d) => ({ ...d, [k]: parseInt(e.target.value, 10) }))}
                      />
                      <span className="dist-row-val">{dist[k]}%</span>
                    </div>
                    <div className="dist-bar"><i className={`dist-bar-fill tone-${tone}`} style={{ width: `${dist[k]}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="switch-row" style={{ marginTop: 12 }}>
          <div><div className="sr-txt">Explanations</div><div className="sr-sub">Adds the reasoning behind the correct answer.</div></div>
          <label className="switch">
            <input
              type="checkbox" checked={includeExplanation}
              onChange={(e) => { setIncludeExplanation(e.target.checked); if (!e.target.checked) setIncludeIncorrect(false); }}
            />
            <span className="track" /><span className="thumb" />
          </label>
        </div>
        {includeExplanation && (
          <div style={{ marginTop: 10, marginLeft: 18 }}>
            <div className="switch-row">
              <div><div className="sr-txt" style={{ fontSize: 12 }}>Also explain incorrect options</div></div>
              <label className="switch">
                <input type="checkbox" checked={includeIncorrect} onChange={(e) => setIncludeIncorrect(e.target.checked)} />
                <span className="track" /><span className="thumb" />
              </label>
            </div>
          </div>
        )}
      </section>

      {/* ---- actions ---- */}
      <section className="card card-pad rise settings-card" style={{ animationDelay: '.15s' }}>
        <div className="set-head" style={{ marginBottom: 14 }}>
          <div className="set-ico"><Icon name="robot" size={17} /></div>
          <div><h3>Generate</h3><p>Copy a ready-made prompt for any AI tool, or try the Beta in-app generator.</p></div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-soft" onClick={handleCopyPrompt}><Icon name="robot" size={15} />Copy AI Prompt</button>
          <button className="btn btn-primary" onClick={handleGenerate}><Icon name="sparkle" size={15} />Generate Exam<BetaBadge /></button>
        </div>

        {genStep !== null && (
          <div style={{ marginTop: 16 }}>
            <div className="gen-loading">
              {LOADING_PHASES.map((p, i) => {
                const done = i < genStep, active = i === genStep;
                return (
                  <div key={p} className={`gen-loading-row${done ? ' done' : ''}${active ? ' active' : ''}`}>
                    {done ? <Icon name="check" size={13} strokeWidth={3} /> : active ? <span className="gen-spinner" /> : <span className="gen-loading-dot" />}
                    <span>{p}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {generatedResult && (
          <div style={{ marginTop: 16 }}>
            <div className="gen-preview-banner">
              <Icon name="info" size={14} /><BetaBadge />
              <span>This is a preview — <b>Generate Exam</b> is a Beta mock, not wired to a real pipeline yet. Use <b>Copy AI Prompt</b> above for a working flow today.</span>
            </div>
            <div className="gen-qcards">
              {generatedResult.map((q, i) => (
                <QuestionCard key={i} q={q} includeDifficulty={includeDifficulty} includeExplanation={includeExplanation} includeIncorrect={includeIncorrect} />
              ))}
            </div>
            <button className="btn btn-ghost" disabled title="Coming soon"><Icon name="upload" size={14} />Import these questions — coming soon</button>
          </div>
        )}
      </section>

      {/* ---- suggested group ---- */}
      <section className="card card-pad rise settings-card" style={{ animationDelay: '.2s' }}>
        <div className="set-head">
          <div className="set-ico"><Icon name="sparkle" size={17} /></div>
          <div><h3>Suggested Exam Group <BetaBadge /></h3><p>Based on this content, this looks like it belongs in <b>"{suggestedGroup}"</b>.</p></div>
        </div>
        <button className="btn btn-soft btn-sm" onClick={() => toast('Beta — this will wire up once Generate Exam produces a real bank to assign.', 'info')}>
          <Icon name="layers" size={13} />Assign to group
        </button>
      </section>
    </div>
  );
}
