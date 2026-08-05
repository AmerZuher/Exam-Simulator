import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useExams } from '../../hooks/useExams';
import { useDialog } from '../../hooks/useDialog';
import { examsService } from '../../services/examsService';
import { activityService } from '../../services/activityService';
import { calculateSRS, fmtInterval } from '../../utils/srs';
import { Icon } from '../../utils/icons';
import { BankBadge } from '../ui/BankBadge';
import { MasteryRing } from '../ui/MasteryRing';
import { TypeChip } from '../ui/TypeChip';
import { EmptyState } from '../ui/EmptyState';
import type { Exam, Question, StudySession } from '../../types/exam';

interface ReviewProps {
  exam?: Exam;
  onDashboard: () => void;
  onProgress: () => void;
  onExam: (examId: string) => void;
  onStudy: (examId: string) => void;
}

const GRADES = [
  { key: 'again', label: 'Again', hint: 'Blank — show it soon', color: 'var(--bad)' },
  { key: 'hard', label: 'Hard', hint: 'Recalled with effort', color: 'var(--warn)' },
  { key: 'good', label: 'Good', hint: 'Recalled correctly', color: 'var(--acc)' },
  { key: 'easy', label: 'Easy', hint: 'Instant — push it out', color: 'var(--ok)' },
] as const;

const AGAIN_GAP = 4;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface Session {
  examId: string;
  examName: string;
  queue: string[];
  byId: Map<string, Question>;
  pos: number;
  revealed: boolean;
  startedAt: number;
  cardShownAt: number;
  done: number;
  planned: number;
  grades: number[];
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isDue(session?: StudySession): boolean {
  return !session || session.grade == null || new Date(session.next_review) <= new Date();
}

export function Review({ exam, onDashboard, onProgress, onExam, onStudy }: ReviewProps) {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const { exams } = useExams();
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Map<string, StudySession>>(new Map());
  const [tick, setTick] = useState(0);
  const questionsRef = useRef<Question[]>([]);

  const buildQueue = async (targetExam: Exam) => {
    if (!user) return;
    const [questions, studySessions] = await Promise.all([
      examsService.getQuestions(targetExam.id),
      examsService.getStudySessions(user.id, targetExam.id),
    ]);
    questionsRef.current = questions;
    const byId = new Map(questions.map((q) => [q.id, q]));
    const sMap = new Map(studySessions.map((s) => [s.question_id, s]));
    setSessions(sMap);

    const dueIds = questions.filter((q) => isDue(sMap.get(q.id))).map((q) => q.id).slice(0, 20);
    if (!dueIds.length) { setSession(null); return; }

    setSession({
      examId: targetExam.id,
      examName: targetExam.name,
      queue: dueIds,
      byId,
      pos: 0,
      revealed: false,
      startedAt: Date.now(),
      cardShownAt: Date.now(),
      done: 0,
      planned: dueIds.length,
      grades: [0, 0, 0, 0],
    });
  };

  useEffect(() => {
    if (exam) buildQueue(exam);
    else setSession(null);
  }, [exam?.id, user?.id]);

  // Ticks the elapsed-time display once a second while a session is active.
  useEffect(() => {
    if (!session || session.pos >= session.queue.length) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [session]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!session || (e.target as HTMLElement)?.matches?.('input, textarea, select')) return;
      if (session.pos >= session.queue.length) return;
      if (!session.revealed) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
      } else if (/^[1-4]$/.test(e.key)) {
        e.preventDefault(); applyGrade(parseInt(e.key, 10) - 1);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); applyGrade(2);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [session]);

  const reveal = () => setSession((s) => (s ? { ...s, revealed: true } : s));

  const applyGrade = async (gIdx: number) => {
    if (!session || !session.revealed || !user) return;
    const id = session.queue[session.pos];
    const grade = (gIdx + 1) as 1 | 2 | 3 | 4;

    const existing = sessions.get(id);
    const srsState = existing?.grade != null
      ? { easeFactor: existing.ease_factor, interval: existing.interval, nextReview: new Date(existing.next_review) }
      : { easeFactor: 2.5, interval: 0, nextReview: new Date() };
    const next = calculateSRS(grade, srsState);

    const updated = await examsService.createOrUpdateStudySession({
      id: existing?.id || crypto.randomUUID(),
      user_id: user.id,
      exam_id: session.examId,
      question_id: id,
      grade,
      ease_factor: next.easeFactor,
      interval: next.interval,
      next_review: next.nextReview.toISOString(),
      mastered: existing?.mastered ?? false,
      lapses: (existing?.lapses || 0) + (grade === 1 ? 1 : 0),
    });
    setSessions((m) => new Map(m).set(id, updated));

    const ms = Date.now() - session.cardShownAt;
    const correct = grade > 1;
    await activityService.recordQuestionPerf(user.id, session.examId, id, correct, ms);
    await activityService.logActivity(user.id, { reviews: 1, answered: 1, correct: correct ? 1 : 0, seconds: Math.max(0, Math.round(ms / 1000)) });

    const grades = session.grades.slice();
    grades[gIdx]++;

    let queue = session.queue;
    let done = session.done;
    if (gIdx === 0) {
      queue = queue.slice();
      queue.splice(Math.min(queue.length, session.pos + 1 + AGAIN_GAP), 0, id);
    } else {
      done++;
    }

    setSession({
      ...session, queue, done, grades,
      pos: session.pos + 1,
      revealed: false,
      cardShownAt: Date.now(),
    });
  };

  const quit = async () => {
    if (!session) return;
    const ok = await confirm({
      title: 'End this review?',
      desc: 'Cards already graded are saved — the rest stay in the queue for next time.',
      confirmLabel: 'End review',
    });
    if (!ok) return;
    setSession({ ...session, pos: session.queue.length });
  };

  // ---- entry states ----

  if (!exam) {
    if (exams.length === 0) {
      return <div className="view"><EmptyState icon="book" title="No banks to review" desc="Import a question bank first." /></div>;
    }
    return (
      <div className="view" style={{ maxWidth: 760, margin: '0 auto' }}>
        <section className="card card-pad rise">
          <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}><Icon name="cards" size={17} /> Pick a deck to review</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, margin: '5px 0 16px' }}>
            Each deck schedules itself. Cards you find hard come back sooner; cards you know get pushed weeks out.
          </p>
          <div className="review-picks">
            {exams.map((e) => (
              <ReviewPickRow key={e.id} exam={e} userId={user?.id} onPick={() => buildQueue(e)} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="view" style={{ maxWidth: 640, margin: '0 auto' }}>
        <section className="card card-pad rise caught-up">
          <div className="cu-ring">
            <MasteryRing pct={100} size={96} stroke={8} />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 16 }}>Queue clear for {exam.name}</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginTop: 6 }}>
            Nothing is due right now. Check back later, or study ahead.
          </p>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center', marginTop: 20 }}>
            <button className="btn btn-soft" onClick={async () => {
              const questions = questionsRef.current.length ? questionsRef.current : await examsService.getQuestions(exam.id);
              const ids = questions.slice(0, 20).map((q) => q.id);
              if (!ids.length) return;
              setSession({
                examId: exam.id, examName: exam.name, queue: ids,
                byId: new Map(questions.map((q) => [q.id, q])),
                pos: 0, revealed: false, startedAt: Date.now(), cardShownAt: Date.now(),
                done: 0, planned: ids.length, grades: [0, 0, 0, 0],
              });
            }}>
              <Icon name="bolt" size={15} />Study ahead anyway
            </button>
            <button className="btn btn-ghost" onClick={() => onStudy(exam.id)}><Icon name="study" size={15} />Q&A preview</button>
            <button className="btn btn-ghost" onClick={onDashboard}><Icon name="home" size={15} />Dashboard</button>
          </div>
        </section>
      </div>
    );
  }

  // ---- summary ----
  if (session.pos >= session.queue.length) {
    const total = session.grades.reduce((a, b) => a + b, 0);
    const kept = session.grades[1] + session.grades[2] + session.grades[3];
    const recall = total ? Math.round((kept / total) * 100) : 0;
    const secs = Math.round((Date.now() - session.startedAt) / 1000);
    const perCard = total ? Math.round(secs / total) : 0;
    const remaining = questionsRef.current.filter((q) => isDue(sessions.get(q.id))).length;

    return (
      <div className="view">
        <section className="card card-pad rise review-summary">
          <div className="ring-wrap">
            <MasteryRing pct={recall} size={132} stroke={9} />
            <div className="ring-label"><div className="ring-pct">{recall}%</div><div className="ring-sub">recalled</div></div>
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em' }}>Review complete</h2>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, marginTop: 5 }}>
              {session.examName} · {total} card{total === 1 ? '' : 's'} graded in {fmtDuration(secs)}
            </p>
            <div className="mini-stats" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 16, maxWidth: 430 }}>
              <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--acc)' }}>{session.done}</div><div className="ms-l">Cards cleared</div></div>
              <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--warn)' }}>{perCard}s</div><div className="ms-l">Per card</div></div>
              <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--muted)' }}>{remaining}</div><div className="ms-l">Still due</div></div>
            </div>
            <div className="acc-bars" style={{ marginTop: 16, maxWidth: 430 }}>
              {GRADES.map((g, i) => {
                const n = session.grades[i];
                const pct = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div className="acc-bar-row" key={g.key}>
                    <span className="ab-l">{g.label}</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: g.color }} /></div>
                    <span className="ab-n">{n}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 9, marginTop: 20, flexWrap: 'wrap' }}>
              {remaining > 0 && (
                <button className="btn btn-primary" onClick={() => buildQueue(exam)}>
                  <Icon name="cards" size={15} />Review {Math.min(remaining, 20)} more
                </button>
              )}
              <button className="btn btn-soft" onClick={() => onExam(exam.id)}><Icon name="play" size={14} />Take the exam</button>
              <button className="btn btn-ghost" onClick={onProgress}><Icon name="chart" size={15} />See progress</button>
              <button className="btn btn-ghost" onClick={onDashboard}><Icon name="home" size={15} />Dashboard</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ---- active card ----
  const id = session.queue[session.pos];
  const q = session.byId.get(id)!;
  const existing = sessions.get(id);
  const stageLbl = existing?.grade == null ? 'New' : existing.interval < 7 ? 'Learning' : 'Review';
  const stageCls = existing?.grade == null ? 's-new' : existing.interval < 7 ? 's-learn' : 's-rev';
  const pct = Math.round((session.done / Math.max(1, session.planned)) * 100);
  void tick; // forces the elapsed-time re-render each second

  return (
    <div className="view review-view">
      <div className="review-bar">
        <button className="icon-btn" title="End review" aria-label="End review" onClick={quit}><Icon name="x" size={15} /></button>
        <div className="rb-meta">
          <div className="rb-bank">{session.examName}</div>
          <div className="rb-sub">{session.done} of {session.planned} · {fmtDuration(Math.round((Date.now() - session.startedAt) / 1000))}</div>
        </div>
        <div className="rb-track"><i style={{ width: `${pct}%` }} /></div>
        <span className={`rev-stage ${stageCls}`}>{stageLbl}</span>
      </div>

      <div className={`flashcard ${session.revealed ? 'flipped' : ''}`}>
        <div className="fc-top">
          <TypeChip type={q.type} />
          <button
            className={`star-btn ${existing?.mastered ? 'on' : ''}`}
            title="Mark as mastered"
            onClick={async () => {
              if (!user) return;
              const updated = await examsService.toggleMastered(user.id, session.examId, id, existing);
              setSessions((m) => new Map(m).set(id, updated));
            }}
          >
            <Icon name="star" size={16} />
          </button>
        </div>
        <div className="fc-q">{q.question}</div>

        {session.revealed ? (
          q.type === 'matching' ? (
            <div className="fc-answer">
              <div className="fc-prompt-lbl">Answer</div>
              <div className="match-pairs">
                {q.left_items.map((l, li) => (
                  <div className="match-pair is-ok" key={li}>
                    <div className="mp-l">{l}</div>
                    <div className="mp-arrow"><Icon name="arrowR" size={15} strokeWidth={2.2} /></div>
                    <div className="mp-r">{q.correct_answers[li] || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="fc-answer">
              <div className="fc-prompt-lbl">Answer</div>
              <div className="opt-list">
                {q.options.map((o, i) => {
                  const ok = q.correct_indices.includes(i);
                  return (
                    <div className={`opt-row ${ok ? 'is-correct' : 'is-dim'}`} key={i}>
                      <span className="opt-letter">{ok ? <Icon name="check" size={12} strokeWidth={3} /> : LETTERS[i % 26]}</span>
                      <span>{o}</span>
                      {ok && <span className="opt-tag t-ok">Correct answer</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          q.type === 'matching' ? (
            <div className="fc-prompt">
              <div className="fc-prompt-lbl">Match these</div>
              <div className="match-pairs">
                {q.left_items.map((l, li) => (
                  <div className="match-pair" key={li}>
                    <div className="mp-l">{l}</div>
                    <div className="mp-arrow"><Icon name="arrowR" size={15} strokeWidth={2.2} /></div>
                    <div className="mp-r fc-blank">?</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="fc-prompt">
              <div className="fc-prompt-lbl">{q.type === 'multiple' ? 'Which of these apply?' : 'Which one?'}</div>
              <div className="opt-list">
                {q.options.map((o, i) => (
                  <div className="opt-row" key={i}>
                    <span className="opt-letter">{LETTERS[i % 26]}</span><span>{o}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {session.revealed ? (
        <div className="grade-bar">
          {GRADES.map((g, i) => {
            const grade = (i + 1) as 1 | 2 | 3 | 4;
            const srsState = existing?.grade != null
              ? { easeFactor: existing.ease_factor, interval: existing.interval, nextReview: new Date(existing.next_review) }
              : { easeFactor: 2.5, interval: 0, nextReview: new Date() };
            const preview = calculateSRS(grade, srsState);
            return (
              <button className={`grade-btn g-${g.key}`} title={g.hint} onClick={() => applyGrade(i)} key={g.key}>
                <span className="gb-key">{i + 1}</span>
                <span className="gb-lbl">{g.label}</span>
                <span className="gb-iv">{fmtInterval(preview.interval)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="review-foot">
          <button className="btn btn-primary btn-lg" onClick={reveal}><Icon name="study" size={17} />Show answer</button>
          <span className="kbd-hint">Space or Enter to flip</span>
        </div>
      )}
    </div>
  );
}

function ReviewPickRow({ exam, userId, onPick }: { exam: Exam; userId?: string; onPick: () => void }) {
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [questions, sessions] = await Promise.all([
        examsService.getQuestions(exam.id),
        examsService.getStudySessions(userId, exam.id),
      ]);
      const sMap = new Map(sessions.map((s) => [s.question_id, s]));
      setTotal(questions.length);
      setDueCount(questions.filter((q) => isDue(sMap.get(q.id))).length);
    })();
  }, [exam.id, userId]);

  const done = dueCount === 0;
  return (
    <button className={`review-pick ${done ? 'done' : ''}`} onClick={onPick}>
      <BankBadge icon={exam.icon} color={exam.color} name={exam.name} size="sm" />
      <span className="rp-body">
        <span className="rp-name">{exam.name}</span>
        <span className="rp-meta">{total} question{total === 1 ? '' : 's'}</span>
      </span>
      <span className="rp-count">{dueCount === null ? '…' : done ? '✓' : dueCount}</span>
    </button>
  );
}
