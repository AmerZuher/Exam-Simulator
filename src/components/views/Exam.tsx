import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDialog } from '../../hooks/useDialog';
import { useToast } from '../../hooks/useToast';
import { examsService } from '../../services/examsService';
import { Icon } from '../../utils/icons';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import {
  POOLS, PoolKey, resolvePool, poolCount, cloneQuestion, shuffleQuestionOptions,
  shuffle, resolveTimeLimit, isAnswered, gradeQuestion, medianOf, Response,
} from '../../utils/examShared';
import { formatTime } from '../../utils/parser';
import { calculateSRS } from '../../utils/srs';
import { activityService } from '../../services/activityService';
import type { Exam as ExamType, Question, StudySession, AttemptResult } from '../../types/exam';

interface DrillSpec {
  examId: string;
  questionIds: string[];
  label: string;
  passPct: number;
}

export interface MixedEntry {
  examId: string;
  examName: string;
  question: Question;
}

export interface MixedSpec {
  label: string;
  passPct: number;
  timeLimit: string;
  entries: MixedEntry[];
}

interface ExamProps {
  exam?: ExamType;
  drill?: DrillSpec;
  onDrillConsumed?: () => void;
  mixed?: MixedSpec;
  onFinish: (attemptId: string) => void;
  onExit: () => void;
}

interface MixedSummary {
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
  seconds: number;
  perBank: { examId: string; examName: string; correct: number; total: number }[];
}

interface SetupConfig {
  pool: PoolKey;
  limit: string;
  timeLimit: string;
  passPct: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

interface Session {
  questions: Question[];
  index: number;
  responses: Record<number, Response>;
  flags: Record<number, boolean>;
  times: Record<number, number>;
  seconds: number;
  timeLimit: number;
  passPct: number;
  startedAt: number;
  label?: string;
  origin?: string[]; // parallel to `questions` — owning exam id per question, mixed sessions only
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function Exam({ exam, drill, onDrillConsumed, mixed, onFinish, onExit }: ExamProps) {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const toast = useToast();
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [paused, setPaused] = useState(false);
  const [expired, setExpired] = useState(false);
  const [mixedSummary, setMixedSummary] = useState<MixedSummary | null>(null);
  const qStartRef = useRef(Date.now());
  const warnedRef = useRef<{ five: boolean; one: boolean }>({ five: false, one: false });
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!user || !exam || mixed) return;
    (async () => {
      const [questions, sessions] = await Promise.all([
        examsService.getQuestions(exam.id),
        examsService.getStudySessions(user.id, exam.id),
      ]);
      setAllQuestions(questions);
      setStudySessions(sessions);
    })();
  }, [exam?.id, user?.id, mixed]);

  const bankQuestionTime = useCallback(() => {
    setSession((s) => {
      if (!s || paused) { qStartRef.current = Date.now(); return s; }
      const ms = Date.now() - qStartRef.current;
      qStartRef.current = Date.now();
      if (ms <= 0 || ms >= 30 * 60 * 1000) return s;
      return { ...s, times: { ...s.times, [s.index]: (s.times[s.index] || 0) + ms } };
    });
  }, [paused]);

  const launch = (cfg: SetupConfig) => {
    let qs = resolvePool(allQuestions, studySessions, cfg.pool).map(cloneQuestion);
    if (cfg.shuffleOptions) qs = qs.map(shuffleQuestionOptions);
    if (cfg.shuffleQuestions) qs = shuffle(qs);
    if (cfg.limit !== 'all') qs = qs.slice(0, parseInt(cfg.limit, 10));
    if (!qs.length) return;

    qStartRef.current = Date.now();
    warnedRef.current = { five: false, one: false };
    setPaused(false);
    setExpired(false);
    setSession({
      questions: qs,
      index: 0,
      responses: {},
      flags: {},
      times: {},
      seconds: 0,
      timeLimit: resolveTimeLimit(cfg.timeLimit, qs.length),
      passPct: cfg.passPct,
      startedAt: Date.now(),
    });
  };

  // Relaunches this exam pinned to an explicit question-id list (in the
  // given order, no shuffle) — used by Results' "Drill the N you missed".
  const launchDrill = useCallback((spec: DrillSpec) => {
    const byId = new Map(allQuestions.map((q) => [q.id, q]));
    const qs = spec.questionIds.map((id) => byId.get(id)).filter((q): q is Question => !!q).map(cloneQuestion);
    if (!qs.length) return;

    qStartRef.current = Date.now();
    warnedRef.current = { five: false, one: false };
    setPaused(false);
    setExpired(false);
    setSession({
      questions: qs,
      index: 0,
      responses: {},
      flags: {},
      times: {},
      seconds: 0,
      timeLimit: 0,
      passPct: spec.passPct,
      startedAt: Date.now(),
      label: spec.label,
    });
  }, [allQuestions]);

  useEffect(() => {
    if (drill && exam && drill.examId === exam.id && allQuestions.length && !session) {
      launchDrill(drill);
      onDrillConsumed?.();
    }
  }, [drill, allQuestions, exam?.id]);

  // Mixed (cross-bank custom) sessions arrive fully pre-resolved by the
  // caller — no pool/setup step, just launch straight in, and fetch SRS
  // continuity state for every distinct bank involved.
  useEffect(() => {
    if (!mixed || !user || session) return;
    (async () => {
      const distinctExamIds = Array.from(new Set(mixed.entries.map((e) => e.examId)));
      const sessionLists = await Promise.all(distinctExamIds.map((id) => examsService.getStudySessions(user.id, id)));
      setStudySessions(sessionLists.flat());

      const qs = mixed.entries.map((e) => cloneQuestion(e.question));
      qStartRef.current = Date.now();
      warnedRef.current = { five: false, one: false };
      setPaused(false);
      setExpired(false);
      setSession({
        questions: qs,
        index: 0,
        responses: {},
        flags: {},
        times: {},
        seconds: 0,
        timeLimit: resolveTimeLimit(mixed.timeLimit, qs.length),
        passPct: mixed.passPct,
        startedAt: Date.now(),
        label: mixed.label,
        origin: mixed.entries.map((e) => e.examId),
      });
    })();
  }, [mixed, user?.id]);

  // timer
  useEffect(() => {
    if (!session || paused || expired) return;
    const id = setInterval(() => {
      setSession((s) => {
        if (!s) return s;
        const seconds = s.seconds + 1;
        if (s.timeLimit) {
          const left = s.timeLimit - seconds;
          if (left === 300 && !warnedRef.current.five) { warnedRef.current.five = true; toast('Five minutes left.', 'err'); }
          if (left === 60 && !warnedRef.current.one) { warnedRef.current.one = true; toast('One minute left.', 'err'); }
          if (left <= 0) { setExpired(true); return { ...s, seconds }; }
        }
        return { ...s, seconds };
      });
      forceTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [session, paused, expired]);

  // time-expired auto submit
  useEffect(() => {
    if (expired) {
      bankQuestionTime();
      const t = setTimeout(() => finish(), 1200);
      return () => clearTimeout(t);
    }
  }, [expired]);

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
    if (paused || expired || !session) return;
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

  const toggleFlag = () => {
    setSession((s) => {
      if (!s) return s;
      const flags = { ...s.flags };
      if (flags[s.index]) delete flags[s.index]; else flags[s.index] = true;
      return { ...s, flags };
    });
  };

  // keyboard shortcuts
  useEffect(() => {
    if (!session) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches?.('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
      else if (e.key === 'f' || e.key === 'F') toggleFlag();
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (session.index < session.questions.length - 1) navigate(1);
        else confirmSubmit();
      }
      else if (/^[1-9]$/.test(e.key)) {
        const q = session.questions[session.index];
        const oi = parseInt(e.key, 10) - 1;
        if (q.type !== 'matching' && oi < q.options.length) selectOption(oi);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [session, paused, expired]);

  const finish = async () => {
    if (!session || !user) return;
    bankQuestionTime();
    const qs = session.questions;
    const examIdFor = (i: number) => session.origin?.[i] || exam!.id;
    let correct = 0;
    const results: AttemptResult[] = qs.map((q, i) => {
      const resp = session.responses[i];
      const grade = gradeQuestion(q, resp);
      if (grade.isCorrect) correct++;
      return {
        question_id: q.id,
        response: resp ?? null,
        correct: grade.isCorrect,
        skipped: grade.isSkipped,
        flagged: !!session.flags[i],
        time_spent_ms: session.times[i] || 0,
      };
    });

    const pct = Math.round((correct / qs.length) * 100);
    const passed = pct >= session.passPct;
    const median = medianOf(results.map((r) => r.time_spent_ms).filter((m) => m > 0));

    const attempt = await examsService.createExamAttempt({
      user_id: user.id,
      exam_id: session.origin ? null : exam!.id,
      mode: 'exam',
      label: session.label,
      score: pct,
      correct_count: correct,
      total_questions: qs.length,
      time_taken: session.seconds,
      pass_pct: session.passPct,
      passed,
      started_at: new Date(session.startedAt).toISOString(),
      completed_at: new Date().toISOString(),
      results,
      origin: session.origin ? qs.map((q, i) => ({ exam_id: session.origin![i], question_id: q.id })) : null,
    });

    // feed the SM-2 scheduler + per-question performance from exam results
    for (const [i, q] of qs.entries()) {
      const r = results[i];
      const qExamId = examIdFor(i);
      const existing = studySessions.find((s) => s.question_id === q.id);
      const fast = r.time_spent_ms > 0 && median > 0 && r.time_spent_ms < median * 0.6;
      const grade = r.skipped ? 1 : r.correct ? (fast ? 4 : 3) : 1;
      const srsState = existing?.grade != null
        ? { easeFactor: existing.ease_factor, interval: existing.interval, nextReview: new Date(existing.next_review) }
        : { easeFactor: 2.5, interval: 0, nextReview: new Date() };
      const next = calculateSRS(grade as 1 | 2 | 3 | 4, srsState);
      await examsService.createOrUpdateStudySession({
        id: existing?.id || crypto.randomUUID(),
        user_id: user.id,
        exam_id: qExamId,
        question_id: q.id,
        grade: grade as 1 | 2 | 3 | 4,
        ease_factor: next.easeFactor,
        interval: next.interval,
        next_review: next.nextReview.toISOString(),
        mastered: existing?.mastered ?? false,
        lapses: (existing?.lapses || 0) + (grade === 1 ? 1 : 0),
      });
      await activityService.recordQuestionPerf(user.id, qExamId, q.id, r.correct, r.time_spent_ms);
    }
    await activityService.logActivity(user.id, { answered: qs.length, correct, seconds: session.seconds, attempts: 1 });

    setSession(null);

    if (session.origin && mixed) {
      const perBankMap = new Map<string, { examId: string; examName: string; correct: number; total: number }>();
      mixed.entries.forEach((e, i) => {
        const row = perBankMap.get(e.examId) || { examId: e.examId, examName: e.examName, correct: 0, total: 0 };
        row.total++;
        if (results[i].correct) row.correct++;
        perBankMap.set(e.examId, row);
      });
      setMixedSummary({
        correct, total: qs.length, pct, passed, seconds: session.seconds,
        perBank: Array.from(perBankMap.values()),
      });
      return;
    }
    onFinish(attempt.id);
  };

  const confirmSubmit = async () => {
    if (!session) return;
    const unanswered = session.questions.filter((q, i) => !isAnswered(q, session.responses[i])).length;
    const flagged = Object.keys(session.flags).length;
    const desc = unanswered
      ? `You still have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}${flagged ? ` and ${flagged} flagged` : ''}. Submit anyway?`
      : flagged ? `You have ${flagged} flagged question${flagged > 1 ? 's' : ''}. Submit now?` : 'All questions answered — nice. Submit now?';
    const ok = await confirm({ title: 'Submit exam?', desc, confirmLabel: 'Submit exam' });
    if (ok) finish();
  };

  const handleSaveExit = async () => {
    if (!session) return;
    const ok = await confirm({
      title: 'Save & exit?',
      desc: 'Your progress in this browser tab will be lost — exam sessions do not persist across page reloads yet.',
      confirmLabel: 'Save & exit', danger: true,
    });
    if (ok) { setSession(null); onExit(); }
  };

  // ---- mixed (custom cross-bank) results summary ----
  if (mixedSummary) {
    return <MixedResultsSummary summary={mixedSummary} onExit={onExit} />;
  }

  // ---- setup screen ----
  if (!session) {
    if (mixed || drill) return null; // auto-launch effects resolve this on the next tick
    return <ExamSetup exam={exam!} allQuestions={allQuestions} studySessions={studySessions} onStart={launch} onCancel={onExit} />;
  }

  const q = session.questions[session.index];
  const resp = session.responses[session.index];
  const answeredCount = session.questions.filter((qq, i) => isAnswered(qq, session.responses[i])).length;
  const flaggedCount = Object.keys(session.flags).length;
  const left = session.timeLimit ? Math.max(0, session.timeLimit - session.seconds) : null;
  const clock = formatTime(left === null ? session.seconds : left);
  const timeUrgency = left !== null && left <= 60 ? 'bad' : left !== null && left <= 300 ? 'warn' : null;

  return (
    <div className="view exam-layout">
      <section className="card card-pad exam-main rise">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span className="chip chip-mut">Question {session.index + 1} / {session.questions.length}</span>
          <span className={`chip ${q.type === 'multiple' ? 'chip-warn' : q.type === 'matching' ? 'chip-teal' : 'chip-acc'}`}>
            {q.type === 'multiple' ? 'Multi-choice' : q.type === 'matching' ? 'Matching' : 'Single choice'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
            {q.type === 'single' ? 'Select one answer' : q.type === 'multiple' ? 'Select all that apply' : 'Match each definition'}
          </span>
          <button className={`flag-btn ${session.flags[session.index] ? 'on' : ''}`} style={{ marginLeft: 'auto' }} onClick={toggleFlag}>
            <Icon name="flag" size={14} /><span>{session.flags[session.index] ? 'Flagged' : 'Flag'}</span>
          </button>
        </div>

        <h2 className="exam-q" style={{ marginTop: 16 }}>{q.question}</h2>

        {q.type === 'matching' ? (
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

        <div className="exam-foot">
          <span className="kbd-hint no-print">← → navigate · 1-9 select · F flag</span>
          <div className="spacer">
            <button className="btn btn-ghost" disabled={session.index === 0} onClick={() => navigate(-1)}><Icon name="chevL" size={15} />Prev</button>
            {session.index < session.questions.length - 1 ? (
              <button className="btn btn-primary" onClick={() => navigate(1)}>Next<Icon name="chevR" size={15} /></button>
            ) : (
              <button className="btn btn-ok" onClick={confirmSubmit}><Icon name="check" size={15} />Submit exam</button>
            )}
          </div>
        </div>
      </section>

      <aside className="card card-pad rise">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="field-lbl" style={{ marginBottom: 4 }}>Active exam</div>
            <div style={{ fontSize: 13, fontWeight: 800, wordBreak: 'break-word' }}>{exam?.name || session.label || 'Custom exam'}</div>
            {session.label && exam && (
              <div className="exam-mode-tag"><Icon name="bolt" size={11} strokeWidth={2.2} />{session.label}</div>
            )}
            {session.timeLimit > 0 && (
              <div
                className="exam-mode-tag t-time"
                style={timeUrgency ? { background: `var(--${timeUrgency}-soft)`, color: `var(--${timeUrgency})`, borderColor: `var(--${timeUrgency}-line)` } : undefined}
              >
                <Icon name="clock" size={11} strokeWidth={2.2} />{clock} left
              </div>
            )}
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round((answeredCount / session.questions.length) * 100)}%` }} /></div>
          <div className="mini-stats">
            <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--acc)' }}>{answeredCount}</div><div className="ms-l">Answered</div></div>
            <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--warn)' }}>{flaggedCount}</div><div className="ms-l">Flagged</div></div>
          </div>
          <div>
            <div className="field-lbl">Questions</div>
            <div style={{ maxHeight: 268, overflowY: 'auto', overflowX: 'hidden', padding: 4, margin: -4 }}>
              <div className="qgrid">
                {session.questions.map((qq, i) => {
                  const isAns = isAnswered(qq, session.responses[i]);
                  return (
                    <button className={`qgrid-btn ${isAns ? 'ans' : ''} ${i === session.index ? 'cur' : ''}`} onClick={() => goTo(i)} key={i}>
                      {i + 1}{session.flags[i] && <span className="qd" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button className="btn btn-ok btn-block" onClick={confirmSubmit}><Icon name="check" size={15} />Submit exam</button>
          <button className="btn btn-danger btn-block" onClick={handleSaveExit}>
            <Icon name="x" size={14} />Save & exit
          </button>
        </div>
      </aside>

      {paused && (
        <div className="pause-veil">
          <div className="card pause-card">
            <div className="pause-ico"><Icon name="pause" size={26} strokeWidth={2.4} /></div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Exam paused</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>Take a breath — the clock is stopped.</div>
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => setPaused(false)}><Icon name="resume" size={17} />Resume exam</button>
          </div>
        </div>
      )}

      {expired && (
        <div className="pause-veil">
          <div className="card pause-card">
            <div className="pause-ico" style={{ background: 'var(--bad-soft)', color: 'var(--bad)', borderColor: 'var(--bad-line)' }}>
              <Icon name="clock" size={26} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Time expired</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>Grading what you had at the buzzer.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamSetup({ exam, allQuestions, studySessions, onStart, onCancel }: {
  exam: ExamType; allQuestions: Question[]; studySessions: StudySession[];
  onStart: (cfg: SetupConfig) => void; onCancel: () => void;
}) {
  const [pool, setPool] = useState<PoolKey>('all');
  const [limit, setLimit] = useState('all');
  const [timeLimit, setTimeLimit] = useState('0');
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
          <div className="modal-title">Configure exam session</div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="field-lbl">Time limit</label>
            <Select
              value={timeLimit}
              onChange={setTimeLimit}
              options={[
                { value: '0', label: 'No limit — count up' },
                { value: '600', label: '10 minutes' },
                { value: '1200', label: '20 minutes' },
                { value: '1800', label: '30 minutes' },
                { value: '2700', label: '45 minutes' },
                { value: '3600', label: '60 minutes' },
                { value: '5400', label: '90 minutes' },
                { value: 'pace', label: 'Exam pace — 90s per question' },
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
          onClick={() => onStart({ pool, limit, timeLimit, passPct, shuffleQuestions: shuffleQ, shuffleOptions: shuffleO })}
        >
          <Icon name="play" size={15} />Start exam
        </button>
      </div>
    </Modal>
  );
}

// A custom cross-bank exam has no single owning bank, so it gets a
// self-contained summary here instead of the shared per-bank Results page
// (matching the original's own reduced treatment of mixed drills — no
// retake-into-setup, no single-bank study link, just the score and a
// per-bank breakdown).
function MixedResultsSummary({ summary, onExit }: { summary: MixedSummary; onExit: () => void }) {
  return (
    <div className="view">
      <section className="card card-pad rise review-summary">
        <div className="ring-wrap">
          <div className="ring-label" style={{ position: 'static' }}>
            <div className="ring-pct">{summary.pct}%</div>
            <div className="ring-sub">{summary.passed ? 'passed' : 'below threshold'}</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em' }}>Custom exam complete</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, marginTop: 5 }}>
            {summary.correct} of {summary.total} correct · {formatTime(summary.seconds)} · across {summary.perBank.length} bank{summary.perBank.length === 1 ? '' : 's'}
          </p>
          <div className="acc-bars" style={{ marginTop: 16, maxWidth: 430 }}>
            {summary.perBank.map((b) => {
              const pct = b.total ? Math.round((b.correct / b.total) * 100) : 0;
              return (
                <div className="acc-bar-row" key={b.examId}>
                  <span className="ab-l">{b.examName}</span>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                  <span className="ab-n">{b.correct}/{b.total}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 20, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={onExit}><Icon name="home" size={15} />Back to group</button>
          </div>
        </div>
      </section>
    </div>
  );
}
