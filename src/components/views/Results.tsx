import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useExplanation } from '../../hooks/useExplanation';
import { examsService } from '../../services/examsService';
import { Icon } from '../../utils/icons';
import { BankBadge } from '../ui/BankBadge';
import { TypeChip } from '../ui/TypeChip';
import { AnswerReview } from '../ui/AnswerReview';
import { LoadingState } from '../ui/LoadingState';
import { EmptyState } from '../ui/EmptyState';
import { formatTime } from '../../utils/parser';
import { typeLabel } from '../../utils/examShared';
import type { Exam, Question, ExamAttempt, AttemptResult, QuestionType } from '../../types/exam';

interface ResultsProps {
  attemptId: string;
  exam: Exam;
  onRetakeExam: () => void;
  onRetakePractice: () => void;
  onDrill: (questionIds: string[], label: string, passPct: number) => void;
  onStudy: () => void;
  onProgress: () => void;
  onDashboard: () => void;
}

type FilterKey = 'all' | 'incorrect' | 'skipped' | 'flagged';

const RING_SIZE = 150;
const RING_R = 62;
const RING_C = 2 * Math.PI * RING_R;

function useCountUp(target: number, active: boolean, duration = 1200) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) { setN(target); return; }
    let raf: number;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return n;
}

function Confetti() {
  const pieces = useMemo(() => {
    const colors = ['var(--acc)', 'var(--ok)', 'var(--warn)', 'var(--teal)', 'var(--bad)'];
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 1.4 + Math.random() * 1,
      rotate: Math.random() * 360,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 5,
    }));
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      <style>{`@keyframes confetti-fall { from { transform: translateY(-10vh) rotate(0deg); opacity: 1; } to { transform: translateY(110vh) rotate(540deg); opacity: 0.4; } }`}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute', top: 0, left: `${p.left}%`, width: p.size, height: p.size * 0.4,
            background: p.color, borderRadius: 2,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugFile(name: string) {
  return name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

export function Results({ attemptId, exam, onRetakeExam, onRetakePractice, onDrill, onStudy, onProgress, onDashboard }: ResultsProps) {
  const { user } = useAuth();
  const { showExplanation } = useExplanation();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [byId, setById] = useState<Map<string, Question>>(new Map());
  const [prevAttempt, setPrevAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [ringActive, setRingActive] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setFilter('all');
      setRingActive(false);
      confettiFired.current = false;
      setShowConfetti(false);
      const [a, questions, attempts] = await Promise.all([
        examsService.getExamAttempt(attemptId),
        examsService.getQuestions(exam.id),
        examsService.getExamAttempts(user.id, exam.id),
      ]);
      setAttempt(a);
      setById(new Map(questions.map((q) => [q.id, q])));
      const idx = attempts.findIndex((x) => x.id === a.id);
      setPrevAttempt(idx > 0 ? attempts[idx - 1] : null);
      setLoading(false);
    })();
  }, [attemptId, exam.id, user?.id]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => setRingActive(true), 30);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (loading || !attempt || confettiFired.current) return;
    if (attempt.passed && attempt.score >= 80) {
      confettiFired.current = true;
      const t = setTimeout(() => setShowConfetti(true), 450);
      const clear = setTimeout(() => setShowConfetti(false), 3500);
      return () => { clearTimeout(t); clearTimeout(clear); };
    }
  }, [loading, attempt]);

  const animatedPct = useCountUp(attempt?.score || 0, ringActive);

  const results: AttemptResult[] = attempt?.results || [];
  const missed = useMemo(() => results.filter((r) => !r.correct && !r.skipped), [results]);

  const perType = useMemo(() => {
    const d: Record<QuestionType, { c: number; t: number }> = {
      single: { c: 0, t: 0 }, multiple: { c: 0, t: 0 }, matching: { c: 0, t: 0 },
    };
    results.forEach((r) => {
      const q = byId.get(r.question_id);
      if (!q) return;
      d[q.type].t++;
      if (r.correct) d[q.type].c++;
    });
    return d;
  }, [results, byId]);

  const timed = useMemo(() => results.filter((r) => r.time_spent_ms > 0), [results]);
  const paceInfo = useMemo(() => {
    if (timed.length < 3) return null;
    const slow = timed.slice().sort((a, b) => b.time_spent_ms - a.time_spent_ms).slice(0, 5);
    const maxMs = slow[0].time_spent_ms;
    const slowWrong = slow.filter((r) => !r.correct).length;
    const fastPool = timed.slice().sort((a, b) => a.time_spent_ms - b.time_spent_ms).slice(0, Math.ceil(timed.length / 3));
    const fastAcc = fastPool.length ? Math.round((fastPool.filter((r) => r.correct).length / fastPool.length) * 100) : 0;
    const verdict = slowWrong >= 3
      ? 'The questions that ate the clock are also the ones you got wrong — that is a knowledge gap, not a pacing problem.'
      : fastAcc < 60
        ? `Your quickest answers were your least accurate (${fastAcc}% right). Slowing down on the easy-looking ones should pay off.`
        : 'Your pace held up: the slow questions were mostly still correct.';
    const sortedAll = timed.slice().sort((a, b) => a.time_spent_ms - b.time_spent_ms);
    const medianMs = sortedAll[Math.floor(sortedAll.length / 2)]?.time_spent_ms || 0;
    const answeredMs = results.reduce((s, r) => s + r.time_spent_ms, 0);
    return { slow, maxMs, verdict, medianMs, answeredMs };
  }, [timed, results]);

  const shownReview = useMemo(() => {
    return results.filter((r) => {
      if (filter === 'incorrect') return !r.correct && !r.skipped;
      if (filter === 'skipped') return r.skipped;
      if (filter === 'flagged') return r.flagged;
      return true;
    });
  }, [results, filter]);

  const exportReport = () => {
    if (!attempt) return;
    const lines: string[] = [
      'ExamPro — attempt report',
      `Bank:      ${exam.name}${attempt.label ? `  (${attempt.label})` : ''}`,
      `Date:      ${new Date().toLocaleString()}`,
      `Score:     ${attempt.score}%  (${attempt.correct_count}/${attempt.total_questions})  —  ${attempt.passed ? 'PASSED' : `below ${attempt.pass_pct}%`}`,
      `Time:      ${formatTime(attempt.time_taken)}`,
      `Breakdown: ${attempt.correct_count} correct · ${results.filter((r) => !r.correct && !r.skipped).length} incorrect · ${results.filter((r) => r.skipped).length} skipped`,
      '',
    ];
    (['single', 'multiple', 'matching'] as QuestionType[]).forEach((t) => {
      const d = perType[t];
      if (d.t) lines.push(`  ${typeLabel(t)}: ${d.c}/${d.t}`);
    });
    lines.push('', 'Questions missed', '-----------------');
    results.forEach((r, i) => {
      if (r.correct) return;
      const q = byId.get(r.question_id);
      if (!q) return;
      lines.push(`${i + 1}. ${q.question}`);
      if (q.type === 'matching') {
        q.left_items.forEach((l, li) => lines.push(`     ${l}  ->  ${q.correct_answers[li] || '—'}`));
      } else {
        q.correct_indices.forEach((ci) => lines.push(`     correct: ${q.options[ci]}`));
        if (r.skipped) lines.push('     yours:   (skipped)');
        else if (q.type === 'single') lines.push(`     yours:   ${q.options[r.response as number]}`);
        else if (Array.isArray(r.response)) lines.push(`     yours:   ${(r.response as number[]).map((oi) => q.options[oi]).join(', ')}`);
      }
      lines.push('');
    });
    download(`${slugFile(exam.name)}-report.txt`, lines.join('\n'));
  };

  if (loading || !attempt) {
    return (
      <div className="view">
        <LoadingState label="Loading results…" />
      </div>
    );
  }

  const ringOffset = ringActive ? RING_C - (RING_C * attempt.score) / 100 : RING_C;
  const paceLabel = attempt.total_questions
    ? (() => {
        const per = Math.round(attempt.time_taken / attempt.total_questions);
        return per < 60 ? `${per}s` : `${Math.floor(per / 60)}m ${per % 60}s`;
      })()
    : '—';
  const delta = prevAttempt ? attempt.score - prevAttempt.score : null;

  return (
    <div className="view">
      {showConfetti && <Confetti />}

      <section className="card card-pad results-hero rise">
        <div className="ring-wrap">
          <svg className="ring-svg" width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            <circle className="ring-track" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none" strokeWidth={10} />
            <circle
              className="ring-val" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none"
              stroke={attempt.passed ? 'var(--ok)' : 'var(--bad)'} strokeWidth={10} strokeLinecap="round"
              strokeDasharray={RING_C} strokeDashoffset={ringOffset}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </svg>
          <div className="ring-label">
            <div className="ring-pct">{animatedPct}%</div>
            <div className="ring-sub">{attempt.passed ? 'Passed' : 'Score'}</div>
          </div>
        </div>

        <div style={{ minWidth: 0, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <BankBadge icon={exam.icon} color={exam.color} name={exam.name} size="sm" />
            <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em' }}>
              {attempt.passed ? 'Excellent work — passed!' : 'Keep practicing — not there yet'}
            </h2>
            <span className={`chip ${attempt.passed ? 'chip-ok' : 'chip-bad'}`}>
              {attempt.passed ? 'Passed' : `Below ${attempt.pass_pct}%`}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, marginTop: 5 }}>
            {exam.name}{attempt.label ? ` · ${attempt.label}` : ''} · completed in {formatTime(attempt.time_taken)}
          </p>

          {delta !== null && (
            delta === 0 ? (
              <div className="res-delta"><Icon name="arrowR" size={13} strokeWidth={2.2} />Same score as your last attempt</div>
            ) : (
              <div className={`res-delta ${delta > 0 ? 'up' : 'dn'}`}>
                {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} point{Math.abs(delta) === 1 ? '' : 's'} {delta > 0 ? 'better' : 'lower'} than your last attempt ({prevAttempt!.score}%)
              </div>
            )
          )}

          <div className="mini-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 16, maxWidth: 460 }}>
            <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--ok)' }}>{attempt.correct_count}</div><div className="ms-l">Correct</div></div>
            <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--bad)' }}>{results.filter((r) => !r.correct && !r.skipped).length}</div><div className="ms-l">Incorrect</div></div>
            <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--muted)' }}>{results.filter((r) => r.skipped).length}</div><div className="ms-l">Skipped</div></div>
            <div className="mini-stat"><div className="ms-n" style={{ color: 'var(--acc)' }}>{paceLabel}</div><div className="ms-l">Per question</div></div>
          </div>

          <div className="acc-bars" style={{ marginTop: 16, maxWidth: 460 }}>
            {(['single', 'multiple', 'matching'] as QuestionType[]).filter((t) => perType[t].t > 0).map((t) => {
              const d = perType[t];
              const pct = d.t ? Math.round((d.c / d.t) * 100) : 0;
              const color = t === 'single' ? 'var(--acc)' : t === 'multiple' ? 'var(--warn)' : 'var(--teal)';
              return (
                <div className="acc-bar-row" key={t}>
                  <span className="ab-l">{typeLabel(t)}</span>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: color }} /></div>
                  <span className="ab-n">{d.c}/{d.t}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 9, marginTop: 20, flexWrap: 'wrap' }}>
            {missed.length > 0 && (
              <button className="btn btn-primary" onClick={() => onDrill(missed.map((m) => m.question_id), `Missed from ${exam.name}`, 100)}>
                <Icon name="bolt" size={15} />Drill the {missed.length} you missed
              </button>
            )}
            <button className="btn btn-soft" onClick={attempt.mode === 'practice' ? onRetakePractice : onRetakeExam}>
              <Icon name="refresh" size={15} />{attempt.mode === 'practice' ? 'Retake in Practice Mode' : 'Retake exam'}
            </button>
            <button className="btn btn-ghost" onClick={onStudy}><Icon name="study" size={15} />Q&amp;A preview</button>
            <button className="btn btn-ghost" onClick={onProgress}><Icon name="chart" size={15} />Progress</button>
            <button className="btn btn-ghost" onClick={exportReport}><Icon name="download" size={15} />Report</button>
          </div>
        </div>
      </section>

      {paceInfo && (
        <section className="card card-pad rise" style={{ margin: '18px 0' }}>
          <div className="chart-head">
            <div>
              <h3>Pace analysis</h3>
              <p className="chart-sub">Median {formatTime(Math.round(paceInfo.medianMs / 1000))} per question · {formatTime(Math.round(paceInfo.answeredMs / 1000))} actively on questions</p>
            </div>
          </div>
          <p className="pace-verdict">{paceInfo.verdict}</p>
          <div className="pace-list">
            {paceInfo.slow.map((r) => {
              const q = byId.get(r.question_id);
              const pct = Math.round((r.time_spent_ms / paceInfo.maxMs) * 100);
              return (
                <div className="pace-row" key={r.question_id}>
                  <div className="pace-bar"><i style={{ width: `${pct}%`, background: r.correct ? 'var(--ok)' : 'var(--bad)' }} /></div>
                  <div className="pace-q">{q?.question || ''}</div>
                  <div className="pace-t mono">{formatTime(Math.round(r.time_spent_ms / 1000))}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="sec-head" style={{ marginTop: 26 }}>
        <h3>Answer review</h3>
        <span className="count-badge">{shownReview.length} of {results.length} shown</span>
        <div className="sec-actions">
          {(['all', 'incorrect', 'skipped', 'flagged'] as FilterKey[]).map((f) => (
            <button key={f} className={`fchip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <section style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {shownReview.length === 0 ? (
          <EmptyState icon="check" title="Nothing to show" desc="No questions match this filter — great sign." />
        ) : (
          shownReview.map((r, i) => {
            const q = byId.get(r.question_id);
            if (!q) return null;
            return (
              <article className="card qcard rise" key={r.question_id}>
                <div className="qcard-head">
                  <span className="qcard-num">#{i + 1}</span>
                  <TypeChip type={q.type} />
                  {r.flagged && <span className="chip chip-warn"><Icon name="flag" size={10} strokeWidth={2.4} />Flagged</span>}
                  {r.time_spent_ms > 0 && (
                    <span className="chip chip-mut"><Icon name="clock" size={10} strokeWidth={2.2} />{formatTime(Math.round(r.time_spent_ms / 1000))}</span>
                  )}
                  {q.explanation && (
                    <button className="icon-btn" title="Why?" aria-label="Show explanation" onClick={() => showExplanation(q)}>
                      <Icon name="lightbulb" size={14} />
                    </button>
                  )}
                  <div className="spacer">
                    <span className={`chip ${r.correct ? 'chip-ok' : r.skipped ? 'chip-mut' : 'chip-bad'}`}>
                      {r.correct ? 'Correct' : r.skipped ? 'Skipped' : 'Incorrect'}
                    </span>
                  </div>
                </div>
                <div className="qcard-body">
                  <div className="qcard-q">{q.question}</div>
                  <AnswerReview q={q} resp={r.response as any} />
                </div>
              </article>
            );
          })
        )}
      </section>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={onDashboard}><Icon name="home" size={14} />Dashboard</button>
      </div>
    </div>
  );
}
