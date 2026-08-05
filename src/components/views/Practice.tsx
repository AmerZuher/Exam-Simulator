import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDialog } from '../../hooks/useDialog';
import { examsService } from '../../services/examsService';
import { activityService } from '../../services/activityService';
import { Icon } from '../../utils/icons';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { AnswerReview } from '../ui/AnswerReview';
import {
  POOLS, PoolKey, resolvePool, poolCount, cloneQuestion, shuffleQuestionOptions,
  shuffle, isAnswered, gradeQuestion, typeLabel, Response, Grade,
} from '../../utils/examShared';
import { calculateSRS } from '../../utils/srs';
import type { Exam as ExamType, Question, StudySession, AttemptResult } from '../../types/exam';

interface PracticeProps {
  exam: ExamType;
  onFinish: (attemptId: string) => void;
  onExit: () => void;
}

interface SetupConfig {
  pool: PoolKey;
  limit: string;
  passPct: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

interface Session {
  questions: Question[];
  index: number;
  responses: Record<number, Response>;
  checked: Record<number, boolean>;
  results: Record<number, Grade>;
  times: Record<number, number>;
  passPct: number;
  startedAt: number;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function Practice({ exam, onFinish, onExit }: PracticeProps) {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const qStartRef = useRef(Date.now());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [questions, sessions] = await Promise.all([
        examsService.getQuestions(exam.id),
        examsService.getStudySessions(user.id, exam.id),
      ]);
      setAllQuestions(questions);
      setStudySessions(sessions);
    })();
  }, [exam.id, user?.id]);

  const bankQuestionTime = useCallback(() => {
    setSession((s) => {
      if (!s) { qStartRef.current = Date.now(); return s; }
      const ms = Date.now() - qStartRef.current;
      qStartRef.current = Date.now();
      if (ms <= 0 || ms >= 30 * 60 * 1000) return s;
      return { ...s, times: { ...s.times, [s.index]: (s.times[s.index] || 0) + ms } };
    });
  }, []);

  const launch = (cfg: SetupConfig) => {
    let qs = resolvePool(allQuestions, studySessions, cfg.pool).map(cloneQuestion);
    if (cfg.shuffleOptions) qs = qs.map(shuffleQuestionOptions);
    if (cfg.shuffleQuestions) qs = shuffle(qs);
    if (cfg.limit !== 'all') qs = qs.slice(0, parseInt(cfg.limit, 10));
    if (!qs.length) return;

    qStartRef.current = Date.now();
    setSession({
      questions: qs,
      index: 0,
      responses: {},
      checked: {},
      results: {},
      times: {},
      passPct: cfg.passPct,
      startedAt: Date.now(),
    });
  };

  const navigate = (dir: number) => {
    setSession((s) => {
      if (!s) return s;
      const next = s.index + dir;
      if (next < 0 || next >= s.questions.length) return s;
      return { ...s, index: next };
    });
    bankQuestionTime();
  };

  const goTo = (i: number) => {
    setSession((s) => (s ? { ...s, index: i } : s));
    bankQuestionTime();
  };

  const selectOption = (oi: number) => {
    if (!session || session.checked[session.index]) return;
    const q = session.questions[session.index];
    setSession((s) => {
      if (!s) return s;
      const responses = { ...s.responses };
      if (q.type === 'single') {
        responses[s.index] = oi;
      } else {
        const cur = Array.isArray(responses[s.index]) ? (responses[s.index] as number[]).slice() : [];
        const at = cur.indexOf(oi);
        if (at === -1) cur.push(oi); else cur.splice(at, 1);
        responses[s.index] = cur;
      }
      return { ...s, responses };
    });
  };

  const setMatchResponse = (li: number, value: string) => {
    setSession((s) => {
      if (!s) return s;
      const existing = (s.responses[s.index] as Record<number, string>) || {};
      return { ...s, responses: { ...s.responses, [s.index]: { ...existing, [li]: value } } };
    });
  };

  // Grades one question immediately and locks it — the core practice-mode
  // interaction, distinct from exam.js's grade-everything-at-the-end batch.
  const performCheck = async (i: number) => {
    if (!session || session.checked[i] || !user) return;
    const q = session.questions[i];
    const resp = session.responses[i];
    if (!isAnswered(q, resp)) return;
    bankQuestionTime();
    const grade = gradeQuestion(q, resp);

    setSession((s) => (s ? {
      ...s,
      checked: { ...s.checked, [i]: true },
      results: { ...s.results, [i]: grade },
    } : s));

    const existing = studySessions.find((ss) => ss.question_id === q.id);
    const srsGrade = grade.isCorrect ? 3 : 1;
    const srsState = existing?.grade != null
      ? { easeFactor: existing.ease_factor, interval: existing.interval, nextReview: new Date(existing.next_review) }
      : { easeFactor: 2.5, interval: 0, nextReview: new Date() };
    const next = calculateSRS(srsGrade as 1 | 3, srsState);
    const updated = await examsService.createOrUpdateStudySession({
      id: existing?.id || crypto.randomUUID(),
      user_id: user.id,
      exam_id: exam.id,
      question_id: q.id,
      grade: srsGrade as 1 | 3,
      ease_factor: next.easeFactor,
      interval: next.interval,
      next_review: next.nextReview.toISOString(),
      mastered: existing?.mastered ?? false,
      lapses: (existing?.lapses || 0) + (srsGrade === 1 ? 1 : 0),
    });
    setStudySessions((prev) => {
      const idx = prev.findIndex((ss) => ss.question_id === q.id);
      if (idx === -1) return [...prev, updated];
      const copy = prev.slice();
      copy[idx] = updated;
      return copy;
    });
    await activityService.recordQuestionPerf(user.id, exam.id, q.id, grade.isCorrect, session.times[i] || 0);
  };

  // keyboard shortcuts
  useEffect(() => {
    if (!session) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches?.('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (!session.checked[session.index]) {
          const q = session.questions[session.index];
          if (isAnswered(q, session.responses[session.index])) performCheck(session.index);
        } else if (session.index < session.questions.length - 1) navigate(1);
        else confirmFinish();
      } else if (/^[1-9]$/.test(e.key)) {
        if (session.checked[session.index]) return;
        const q = session.questions[session.index];
        const oi = parseInt(e.key, 10) - 1;
        if (q.type !== 'matching' && oi < q.options.length) selectOption(oi);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [session]);

  const finish = async () => {
    if (!session || !user) return;
    bankQuestionTime();
    const qs = session.questions;
    let correct = 0;
    const results: AttemptResult[] = [];
    for (const [i, q] of qs.entries()) {
      const resp = session.responses[i];
      const grade = session.checked[i] ? session.results[i] : gradeQuestion(q, resp);
      if (grade.isCorrect) correct++;
      results.push({
        question_id: q.id,
        response: resp ?? null,
        correct: grade.isCorrect,
        skipped: grade.isSkipped,
        flagged: false,
        time_spent_ms: session.times[i] || 0,
      });

      // Checked questions already fed the scheduler live in performCheck();
      // anything left unchecked still needs to reach it once.
      if (!session.checked[i]) {
        const existing = studySessions.find((s) => s.question_id === q.id);
        const srsGrade = grade.isSkipped ? 1 : grade.isCorrect ? 3 : 1;
        const srsState = existing?.grade != null
          ? { easeFactor: existing.ease_factor, interval: existing.interval, nextReview: new Date(existing.next_review) }
          : { easeFactor: 2.5, interval: 0, nextReview: new Date() };
        const next = calculateSRS(srsGrade as 1 | 3, srsState);
        await examsService.createOrUpdateStudySession({
          id: existing?.id || crypto.randomUUID(),
          user_id: user.id,
          exam_id: exam.id,
          question_id: q.id,
          grade: srsGrade as 1 | 3,
          ease_factor: next.easeFactor,
          interval: next.interval,
          next_review: next.nextReview.toISOString(),
          mastered: existing?.mastered ?? false,
          lapses: (existing?.lapses || 0) + (srsGrade === 1 ? 1 : 0),
        });
        await activityService.recordQuestionPerf(user.id, exam.id, q.id, grade.isCorrect, session.times[i] || 0);
      }
    }

    const pct = Math.round((correct / qs.length) * 100);
    const passed = pct >= session.passPct;
    const seconds = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));

    const attempt = await examsService.createExamAttempt({
      user_id: user.id,
      exam_id: exam.id,
      mode: 'practice',
      score: pct,
      correct_count: correct,
      total_questions: qs.length,
      time_taken: seconds,
      pass_pct: session.passPct,
      passed,
      started_at: new Date(session.startedAt).toISOString(),
      completed_at: new Date().toISOString(),
      results,
    });
    await activityService.logActivity(user.id, { answered: qs.length, correct, seconds, attempts: 1 });

    setSession(null);
    onFinish(attempt.id);
  };

  const confirmFinish = async () => {
    if (!session) return;
    let unanswered = 0, uncheckedAnswered = 0;
    session.questions.forEach((q, i) => {
      if (!isAnswered(q, session.responses[i])) unanswered++;
      else if (!session.checked[i]) uncheckedAnswered++;
    });
    const parts: string[] = [];
    if (unanswered) parts.push(`${unanswered} unanswered question${unanswered > 1 ? 's' : ''}`);
    if (uncheckedAnswered) parts.push(`${uncheckedAnswered} answered but never checked`);
    const desc = parts.length
      ? `You still have ${parts.join(' and ')}. Finish anyway?`
      : 'Every question is answered and checked — nice. Finish now?';
    const ok = await confirm({ title: 'Finish practice?', desc, confirmLabel: 'Finish practice' });
    if (ok) finish();
  };

  const handleSaveExit = async () => {
    if (!session) return;
    const ok = await confirm({
      title: 'Save & exit?',
      desc: 'Your progress in this browser tab will be lost — practice sessions do not persist across page reloads yet.',
      confirmLabel: 'Save & exit', danger: true,
    });
    if (ok) { setSession(null); onExit(); }
  };

  if (!session) {
    return <PracticeSetup exam={exam} allQuestions={allQuestions} studySessions={studySessions} onStart={launch} onCancel={onExit} />;
  }

  const q = session.questions[session.index];
  const resp = session.responses[session.index];
  const checked = !!session.checked[session.index];
  const grade = checked ? session.results[session.index] : null;
  const isLast = session.index === session.questions.length - 1;
  const answered = isAnswered(q, resp);

  let checkedCount = 0, correctCount = 0;
  session.questions.forEach((_qq, i) => {
    if (session.checked[i]) { checkedCount++; if (session.results[i].isCorrect) correctCount++; }
  });

  return (
    <div className="view exam-layout">
      <section className="card card-pad exam-main rise">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span className="chip chip-mut">Question {session.index + 1} / {session.questions.length}</span>
          <span className={`chip ${q.type === 'multiple' ? 'chip-warn' : q.type === 'matching' ? 'chip-teal' : 'chip-acc'}`}>
            {typeLabel(q.type)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
            {q.type === 'single' ? 'Select one answer' : q.type === 'multiple' ? 'Select all that apply' : 'Match each definition'}
          </span>
          {checked && (
            <span className={`chip ${grade!.isCorrect ? 'chip-ok' : 'chip-bad'}`} style={{ marginLeft: 'auto' }}>
              {grade!.isCorrect ? 'Correct' : 'Incorrect'}
            </span>
          )}
        </div>

        <h2 className="exam-q" style={{ marginTop: 16 }}>{q.question}</h2>

        {checked ? (
          <AnswerReview q={q} resp={resp} />
        ) : q.type === 'matching' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            {q.left_items.map((left_, li) => {
              const sel = ((resp as Record<number, string>) || {})[li] || '';
              return (
                <div key={li} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface-2)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{left_}</div>
                  <Select
                    className="match-sel"
                    value={sel}
                    onChange={(v) => setMatchResponse(li, v)}
                    options={[{ value: '', label: '— choose a match —' }, ...q.right_items.map((r) => ({ value: r, label: r }))]}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>
            {q.options.map((opt, oi) => {
              const sel = q.type === 'single' ? resp === oi : Array.isArray(resp) && resp.indexOf(oi) !== -1;
              return (
                <button className={`opt-btn ${sel ? 'sel' : ''}`} aria-pressed={sel} onClick={() => selectOption(oi)} key={oi}>
                  <span className="opt-letter">{sel ? <Icon name="check" size={12} strokeWidth={3} /> : LETTERS[oi % 26]}</span>
                  <span>{opt}</span>
                  <span className="opt-key">{oi + 1}</span>
                </button>
              );
            })}
          </div>
        )}

        {checked && (
          <div className={`practice-feedback ${grade!.isCorrect ? 'ok' : 'bad'}`}>
            <Icon name={grade!.isCorrect ? 'check' : 'x'} size={15} strokeWidth={2.6} />
            <span>{grade!.isCorrect ? 'Correct!' : 'Not quite — the correct answer is highlighted above.'}</span>
          </div>
        )}

        {checked && q.explanation && (
          <div className="explain-box">
            <div className="explain-box-head"><Icon name="lightbulb" size={14} /><span>Explanation</span></div>
            {q.explanation.correct && <p>{q.explanation.correct}</p>}
            {q.explanation.incorrect && q.explanation.incorrect.length > 0 && (
              <ul>{q.explanation.incorrect.map((t, i) => <li key={i}>{t}</li>)}</ul>
            )}
          </div>
        )}

        <div className="exam-foot">
          <span className="kbd-hint no-print">← → navigate{checked ? '' : ' · 1-9 select · Enter checks'}</span>
          <div className="spacer">
            {!checked && (
              <button className="btn btn-primary" disabled={!answered} onClick={() => performCheck(session.index)}>
                <Icon name="check" size={15} />Check answer
              </button>
            )}
            <button className="btn btn-ghost" disabled={session.index === 0} onClick={() => navigate(-1)}><Icon name="chevL" size={15} />Prev</button>
            {isLast ? (
              <button className="btn btn-ok" onClick={confirmFinish}><Icon name="check" size={15} />Finish practice</button>
            ) : (
              <button className="btn btn-soft" onClick={() => navigate(1)}>Next<Icon name="chevR" size={15} /></button>
            )}
          </div>
        </div>
      </section>

      <aside className="card card-pad rise">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="field-lbl" style={{ marginBottom: 4 }}>Practice session</div>
            <div style={{ fontSize: 13, fontWeight: 800, wordBreak: 'break-word' }}>{exam.name}</div>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round((checkedCount / session.questions.length) * 100)}%` }} /></div>
          <div className="mini-stats">
            <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--acc)' }}>{checkedCount}</div><div className="ms-l">Checked</div></div>
            <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--ok)' }}>{correctCount}</div><div className="ms-l">Correct</div></div>
          </div>
          <div>
            <div className="field-lbl">Questions</div>
            <div style={{ maxHeight: 268, overflowY: 'auto', overflowX: 'hidden', padding: 4, margin: -4 }}>
              <div className="qgrid">
                {session.questions.map((qq, i) => {
                  let cls = 'qgrid-btn';
                  if (session.checked[i]) cls += session.results[i].isCorrect ? ' ok' : ' bad';
                  else if (isAnswered(qq, session.responses[i])) cls += ' ans';
                  if (i === session.index) cls += ' cur';
                  return <button className={cls} onClick={() => goTo(i)} key={i}>{i + 1}</button>;
                })}
              </div>
            </div>
          </div>
          <button className="btn btn-ok btn-block" onClick={confirmFinish}><Icon name="check" size={15} />Finish practice</button>
          <button className="btn btn-danger btn-block" onClick={handleSaveExit}>
            <Icon name="x" size={14} />Save & exit
          </button>
        </div>
      </aside>
    </div>
  );
}

function PracticeSetup({ exam, allQuestions, studySessions, onStart, onCancel }: {
  exam: ExamType; allQuestions: Question[]; studySessions: StudySession[];
  onStart: (cfg: SetupConfig) => void; onCancel: () => void;
}) {
  const [pool, setPool] = useState<PoolKey>('all');
  const [limit, setLimit] = useState('all');
  const [passPct, setPassPct] = useState(70);
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleO, setShuffleO] = useState(false);

  const total = allQuestions.length;
  const brackets = [5, 10, 20, 50, 100, 150].filter((n) => n < total);
  const poolN = poolCount(allQuestions, studySessions, pool);

  return (
    <Modal isOpen onClose={onCancel}>
      <div className="modal-head">
        <div>
          <div className="modal-title">Configure practice session</div>
          <div className="modal-sub">{exam.name} · {total} questions available</div>
        </div>
        <button className="icon-btn" onClick={onCancel}><Icon name="x" size={15} /></button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="field-lbl">Question pool</label>
          <Select
            value={pool}
            onChange={(v) => setPool(v as PoolKey)}
            options={(Object.keys(POOLS) as PoolKey[]).map((k) => {
              const n = poolCount(allQuestions, studySessions, k);
              return { value: k, label: `${POOLS[k].label} (${n})`, disabled: !n };
            })}
          />
          <div className="field-hint">{poolN ? `${poolN} question${poolN === 1 ? '' : 's'} in this pool.` : 'This pool is empty right now.'}</div>
        </div>
        <div>
          <label className="field-lbl">Session length</label>
          <Select
            value={limit}
            onChange={setLimit}
            options={[
              { value: 'all', label: 'No cap — use the whole pool' },
              ...brackets.map((n) => ({ value: String(n), label: `Cap at ${n} questions` })),
            ]}
          />
        </div>
        <div>
          <label className="field-lbl">Pass threshold</label>
          <Select
            value={String(passPct)}
            onChange={(v) => setPassPct(parseInt(v, 10))}
            options={[
              { value: '50', label: '50% — casual' },
              { value: '70', label: '70% — standard' },
              { value: '80', label: '80% — strict' },
              { value: '90', label: '90% — expert' },
            ]}
          />
        </div>
        <div className="switch-row">
          <div><div className="sr-txt">Shuffle question order</div><div className="sr-sub">Randomize the sequence of questions.</div></div>
          <label className="switch"><input type="checkbox" checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)} /><span className="track" /><span className="thumb" /></label>
        </div>
        <div className="switch-row">
          <div><div className="sr-txt">Shuffle answer options</div><div className="sr-sub">Randomize option order (correct answers are re-mapped).</div></div>
          <label className="switch"><input type="checkbox" checked={shuffleO} onChange={(e) => setShuffleO(e.target.checked)} /><span className="track" /><span className="thumb" /></label>
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary"
          disabled={!poolCount(allQuestions, studySessions, pool)}
          onClick={() => onStart({ pool, limit, passPct, shuffleQuestions: shuffleQ, shuffleOptions: shuffleO })}
        >
          <Icon name="brain" size={15} />Start practice
        </button>
      </div>
    </Modal>
  );
}
