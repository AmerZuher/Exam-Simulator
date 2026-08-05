import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { examsService } from '../../services/examsService';
import { activityService, ActivityDay, QuestionPerf } from '../../services/activityService';
import { difficulty } from '../../utils/srs';
import { Icon } from '../../utils/icons';
import { BankBadge } from '../ui/BankBadge';
import { EmptyState } from '../ui/EmptyState';
import { Select } from '../ui/Select';
import { LineChart } from '../ui/LineChart';
import { ColumnChart } from '../ui/ColumnChart';
import { ActivityHeatmap } from '../ui/ActivityHeatmap';
import { StatTile } from '../ui/StatTile';
import { LoadingState } from '../ui/LoadingState';
import { formatTime } from '../../utils/parser';
import type { ExamAttempt, QuestionType, Question } from '../../types/exam';
import type { MixedSpec, MixedEntry } from './Exam';

interface ProgressProps {
  onImport: () => void;
  onReviewBank: (examId: string) => void;
  onDrill: (examId: string, questionIds: string[], label: string, passPct: number) => void;
  onDrillMixed: (spec: MixedSpec) => void;
}

const TYPE_COLORS: Record<QuestionType, string> = { single: 'var(--acc)', multiple: 'var(--warn)', matching: 'var(--teal)' };
const TYPE_LABELS: Record<QuestionType, string> = { single: 'Single choice', multiple: 'Multi-choice', matching: 'Matching' };
const DAY_MS = 86400000;
const HEATMAP_DAYS = 182;

interface WeakRow {
  qid: string;
  examId: string;
  examName: string;
  question: Question;
  acc: number;
  score: number;
  seen: number;
  streak: number;
  ms: number;
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function Progress({ onImport, onReviewBank, onDrill, onDrillMixed }: ProgressProps) {
  const { user } = useAuth();
  const { loading, global, banks } = useDashboardStats();
  const [scope, setScope] = useState('all');
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [accuracy, setAccuracy] = useState<{ type: QuestionType; correct: number; total: number }[]>([]);
  const [forecast, setForecast] = useState<{ ts: number; count: number }[]>([]);
  const [weakRows, setWeakRows] = useState<WeakRow[]>([]);
  const [weakByBank, setWeakByBank] = useState<Map<string, string[]>>(new Map());
  const [detailLoading, setDetailLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [drilling, setDrilling] = useState(false);

  const scopedBanks = useMemo(() => (scope === 'all' ? banks : banks.filter((b) => b.exam.id === scope)), [banks, scope]);

  // ---- study activity (app-wide — not scoped to one bank, matches the original) ----
  useEffect(() => {
    if (!user) return;
    activityService.getActivity(user.id).then(setActivity);
  }, [user?.id]);

  const heatmapDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byDay = new Map(activity.map((a) => [a.day, a]));
    const out: { ts: number; answered: number; seconds: number }[] = [];
    for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
      const ts = today.getTime() - i * DAY_MS;
      const d = byDay.get(dayKey(ts));
      out.push({ ts, answered: d?.answered || 0, seconds: d?.seconds || 0 });
    }
    return out;
  }, [activity]);

  const activityTotals = useMemo(
    () => heatmapDays.reduce((a, d) => { a.answered += d.answered; a.seconds += d.seconds; a.days += d.answered ? 1 : 0; return a; }, { answered: 0, seconds: 0, days: 0 }),
    [heatmapDays]
  );

  const bestStreak = useMemo(() => {
    const activeDays = activity.filter((a) => a.answered > 0 || a.reviews > 0).map((a) => a.day).sort();
    let best = 0, run = 0, prev: number | null = null;
    activeDays.forEach((k) => {
      const t = new Date(`${k}T00:00:00`).getTime();
      run = prev != null && Math.round((t - prev) / DAY_MS) === 1 ? run + 1 : 1;
      prev = t;
      if (run > best) best = run;
    });
    return best;
  }, [activity]);

  // ---- per-scope: attempts, accuracy-by-type, review forecast, weak spots ----
  useEffect(() => {
    if (!user || !banks.length) {
      setAttempts([]); setAccuracy([]); setForecast([]); setWeakRows([]); setWeakByBank(new Map());
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setShowTable(false);

    (async () => {
      const targetExams = scope === 'all' ? banks.map((b) => b.exam) : banks.filter((b) => b.exam.id === scope).map((b) => b.exam);
      const examIds = targetExams.map((e) => e.id);

      const [attemptLists, lightQLists, sessionLists, perfRows] = await Promise.all([
        Promise.all(examIds.map((id) => examsService.getExamAttempts(user.id, id))),
        Promise.all(examIds.map((id) => examsService.getQuestionsLight(id))),
        Promise.all(examIds.map((id) => examsService.getStudySessions(user.id, id))),
        activityService.getQuestionPerf(user.id, examIds),
      ]);
      if (cancelled) return;

      const allAttempts = attemptLists.flat().sort((a, b) => new Date(a.completed_at || a.started_at).getTime() - new Date(b.completed_at || b.started_at).getTime());

      const lightByExam: { examId: string; id: string; type: QuestionType }[] = [];
      targetExams.forEach((e, i) => lightQLists[i].forEach((q) => lightByExam.push({ examId: e.id, id: q.id, type: q.type })));
      const sessionByQ = new Map(sessionLists.flat().map((s) => [s.question_id, s]));

      // accuracy by type — lifetime, from question_perf (includes Review-mode contributions)
      const typeById = new Map(lightByExam.map((q) => [q.id, q.type]));
      const agg: Record<QuestionType, { correct: number; total: number }> = {
        single: { correct: 0, total: 0 }, multiple: { correct: 0, total: 0 }, matching: { correct: 0, total: 0 },
      };
      perfRows.forEach((p) => {
        const t = typeById.get(p.question_id);
        if (!t || !p.seen) return;
        agg[t].total += p.seen;
        agg[t].correct += p.correct;
      });

      // review forecast — next 14 days; untouched questions count as due today
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const startMs = start.getTime();
      const buckets = Array.from({ length: 14 }, (_, i) => ({ ts: startMs + i * DAY_MS, count: 0 }));
      lightByExam.forEach((q) => {
        const s = sessionByQ.get(q.id);
        const due = s ? new Date(s.next_review).getTime() : 0;
        const idx = due <= startMs ? 0 : Math.floor((due - startMs) / DAY_MS);
        if (idx >= 0 && idx < 14) buckets[idx].count++;
      });

      // weak spots — rank per bank (needs at least one miss to qualify)
      const perfByExam = new Map<string, QuestionPerf[]>();
      perfRows.forEach((p) => {
        if (!p.seen || p.correct >= p.seen) return;
        const arr = perfByExam.get(p.exam_id) || [];
        arr.push(p);
        perfByExam.set(p.exam_id, arr);
      });
      const weakByBankMap = new Map<string, string[]>();
      const scored: { qid: string; examId: string; score: number; perf: QuestionPerf }[] = [];
      perfByExam.forEach((arr, examId) => {
        const ranked = arr.map((p) => {
          const s = sessionByQ.get(p.question_id);
          const score = difficulty(
            { seen: p.seen, correct: p.correct, streak: p.streak },
            s ? { easeFactor: s.ease_factor, lapses: s.lapses } : undefined
          );
          return { qid: p.question_id, examId, score, perf: p };
        }).sort((a, b) => b.score - a.score || b.perf.seen - a.perf.seen);
        weakByBankMap.set(examId, ranked.slice(0, 25).map((r) => r.qid));
        scored.push(...ranked);
      });
      scored.sort((a, b) => b.score - a.score || b.perf.seen - a.perf.seen);
      const top8 = scored.slice(0, 8);

      const weakExamIds = Array.from(new Set(top8.map((w) => w.examId)));
      const weakQLists = await Promise.all(weakExamIds.map((id) => examsService.getQuestions(id)));
      if (cancelled) return;
      const qById = new Map(weakQLists.flat().map((q) => [q.id, q]));
      const examNameById = new Map(targetExams.map((e) => [e.id, e.name]));
      const rows: WeakRow[] = top8
        .map((w) => {
          const q = qById.get(w.qid);
          if (!q) return null;
          return {
            qid: w.qid, examId: w.examId, examName: examNameById.get(w.examId) || '',
            question: q, acc: w.perf.correct / w.perf.seen, score: w.score,
            seen: w.perf.seen, streak: w.perf.streak, ms: w.perf.ms,
          };
        })
        .filter((r): r is WeakRow => !!r);

      if (!cancelled) {
        setAttempts(allAttempts);
        setAccuracy((Object.keys(agg) as QuestionType[]).filter((t) => agg[t].total > 0).map((t) => ({ type: t, ...agg[t] })));
        setForecast(buckets);
        setWeakRows(rows);
        setWeakByBank(weakByBankMap);
        setDetailLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, scope, banks]);

  if (loading) {
    return <div className="view"><LoadingState label="Loading progress…" /></div>;
  }

  if (banks.length === 0) {
    return (
      <div className="view">
        <EmptyState
          icon="chart" title="No data yet"
          desc="Import a bank and take an exam or a review session — this page fills itself in from there."
          actions={<button className="btn btn-primary" onClick={onImport}><Icon name="upload" size={15} />Import a bank</button>}
        />
      </div>
    );
  }

  const retention = scopedBanks.length
    ? Math.round(scopedBanks.reduce((s, b) => s + b.retention * b.count, 0) / Math.max(1, scopedBanks.reduce((s, b) => s + b.count, 0)))
    : 0;
  const due = scopedBanks.reduce((s, b) => s + b.due, 0);
  const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);

  const trend = (() => {
    if (attempts.length < 4) return null;
    const avg = (arr: ExamAttempt[]) => arr.reduce((s, a) => s + a.score, 0) / arr.length;
    return Math.round(avg(attempts.slice(-5)) - avg(attempts.slice(0, 5)));
  })();

  const handleReviewNow = () => {
    if (scope !== 'all') { onReviewBank(scope); return; }
    const target = banks.find((b) => b.due > 0);
    if (target) onReviewBank(target.exam.id);
  };

  const handleDrillAll = async () => {
    if (scope !== 'all') {
      const ids = weakByBank.get(scope) || [];
      if (ids.length) onDrill(scope, ids, 'Weak spots', 80);
      return;
    }
    const allEntries: { examId: string; qid: string }[] = [];
    weakByBank.forEach((ids, examId) => ids.forEach((qid) => allEntries.push({ examId, qid })));
    if (!allEntries.length) return;
    setDrilling(true);
    try {
      const capped = allEntries.slice(0, 25);
      const neededExamIds = Array.from(new Set(capped.map((e) => e.examId)));
      const qLists = await Promise.all(neededExamIds.map((id) => examsService.getQuestions(id)));
      const qById = new Map(qLists.flat().map((q) => [q.id, q]));
      const examNameById = new Map(banks.map((b) => [b.exam.id, b.exam.name]));
      const entries: MixedEntry[] = capped
        .map((e) => ({ examId: e.examId, examName: examNameById.get(e.examId) || '', question: qById.get(e.qid) as Question }))
        .filter((e) => e.question);
      if (entries.length) onDrillMixed({ label: 'Weak spots — all banks', passPct: 80, timeLimit: '0', entries });
    } finally {
      setDrilling(false);
    }
  };

  return (
    <div className="view">
      <div className="prog-filter rise">
        <Select
          value={scope}
          onChange={setScope}
          options={[{ value: 'all', label: 'All banks' }, ...banks.map((b) => ({ value: b.exam.id, label: b.exam.name }))]}
        />
        {due > 0 && (
          <button className="btn btn-primary btn-sm" onClick={handleReviewNow}><Icon name="cards" size={14} />{due} due — review now</button>
        )}
      </div>

      <section className="stat-grid" style={{ marginTop: 16 }}>
        <StatTile icon="flame" val={global.streak} label="Day streak" sub={global.streak ? 'keep it alive' : 'study today to start one'} />
        <StatTile icon="target" val={retention} label="Retention" suffix="%" sub="scheduled 7+ days out" />
        <StatTile icon="check" val={activityTotals.answered} label="Answered" sub="in the last 6 months" />
        <StatTile icon="clock" val={Math.round(activityTotals.seconds / 60)} label="Minutes" sub={`${activityTotals.days} active day${activityTotals.days === 1 ? '' : 's'}`} />
      </section>

      <div className="prog-row" style={{ marginTop: 20 }}>
        <section className="card card-pad rise chart-card">
          <div className="chart-head">
            <div>
              <h3>Score by attempt</h3>
              <p className="chart-sub">
                {attempts.length
                  ? <>{attempts.length} attempt{attempts.length === 1 ? '' : 's'} · best {best}%
                    {trend != null && <> · <span className={trend >= 0 ? 'delta-up' : 'delta-dn'}>{trend >= 0 ? `▲ +${trend}` : `▼ ${trend}`} pts vs. your first five</span></>}
                  </>
                  : 'No exam attempts recorded yet'}
              </p>
            </div>
            <div className="chart-legend">
              <span className="cl-item"><i className="cl-dot" style={{ background: 'var(--ok)' }} />passed</span>
              <span className="cl-item"><i className="cl-dot" style={{ background: 'var(--bad)' }} />below threshold</span>
            </div>
          </div>
          {detailLoading ? (
            <p className="chart-empty">Loading…</p>
          ) : (
            <>
              <LineChart
                threshold={70}
                points={attempts.map((a, i) => ({
                  label: new Date(a.completed_at || a.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                  value: a.score,
                  ok: a.passed,
                  title: `#${i + 1} · ${a.score}%`,
                }))}
              />
              {attempts.length > 0 && (
                <>
                  <button className="linklike table-toggle" onClick={() => setShowTable((s) => !s)}>
                    {showTable ? 'Hide table' : 'Show as table'}
                  </button>
                  {showTable && (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead><tr><th>#</th><th>Date</th><th>Bank</th><th>Score</th><th>Correct</th><th>Time</th></tr></thead>
                        <tbody>
                          {attempts.map((a, i) => (
                            <tr key={a.id}>
                              <td className="mono">{i + 1}</td>
                              <td>{new Date(a.completed_at || a.started_at).toLocaleDateString()}</td>
                              <td className="dt-name">{a.label || (scope === 'all' ? banks.find((b) => b.exam.id === a.exam_id)?.exam.name || '—' : banks.find((b) => b.exam.id === scope)?.exam.name || '—')}</td>
                              <td className="mono" style={{ color: a.passed ? 'var(--ok)' : 'var(--bad)' }}>{a.score}%</td>
                              <td className="mono">{a.correct_count}/{a.total_questions}</td>
                              <td className="mono">{formatTime(a.time_taken)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>

        <section className="card card-pad rise chart-card" style={{ animationDelay: '.05s' }}>
          <div className="chart-head">
            <div><h3>Review forecast</h3><p className="chart-sub">Cards the scheduler will surface over the next two weeks</p></div>
          </div>
          {detailLoading ? (
            <p className="chart-empty">Loading…</p>
          ) : (
            <ColumnChart
              unit="cards due"
              bars={forecast.map((d, i) => {
                const date = new Date(d.ts);
                return {
                  label: i === 0 ? 'today' : String(date.getDate()),
                  value: d.count,
                  today: i === 0,
                  title: i === 0 ? 'Due today' : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
                };
              })}
            />
          )}
        </section>
      </div>

      <section className="card card-pad rise chart-card" style={{ marginTop: 18 }}>
        <div className="chart-head">
          <div>
            <h3>Study activity</h3>
            <p className="chart-sub">
              {activityTotals.days} active day{activityTotals.days === 1 ? '' : 's'} in the last 26 weeks · longest streak {bestStreak} day{bestStreak === 1 ? '' : 's'}
            </p>
          </div>
          <div className="chart-legend heat-legend">
            <span>less</span>
            <i className="heat-key lvl-0" /><i className="heat-key lvl-1" /><i className="heat-key lvl-2" /><i className="heat-key lvl-3" /><i className="heat-key lvl-4" />
            <span>more</span>
          </div>
        </div>
        <ActivityHeatmap days={heatmapDays} />
      </section>

      <div className="prog-row" style={{ marginTop: 18 }}>
        <section className="card card-pad rise chart-card">
          <div className="chart-head">
            <div><h3>Accuracy by question type</h3><p className="chart-sub">Lifetime, across every answer you have given</p></div>
          </div>
          {detailLoading ? (
            <p className="chart-empty">Loading…</p>
          ) : accuracy.length === 0 ? (
            <p className="chart-empty">Answer some questions and the split by type shows up here.</p>
          ) : (
            <div className="acc-bars" style={{ marginTop: 6 }}>
              {accuracy.map(({ type, correct, total }) => {
                const pct = Math.round((correct / total) * 100);
                return (
                  <div className="acc-bar-row" key={type}>
                    <span className="ab-l">{TYPE_LABELS[type]}</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: TYPE_COLORS[type] }} /></div>
                    <span className="ab-n">{pct}% · {correct}/{total}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card card-pad rise chart-card" style={{ animationDelay: '.05s' }}>
          <div className="chart-head">
            <div><h3>Deck health</h3><p className="chart-sub">Mastery, retention and what is waiting for you</p></div>
          </div>
          <div className="table-wrap" style={{ marginTop: 4 }}>
            <table className="data-table">
              <thead><tr><th>Bank</th><th>Qs</th><th>Mastery</th><th>Retention</th><th>Best</th><th>Due</th></tr></thead>
              <tbody>
                {scopedBanks.map((b) => {
                  const mastery = b.count ? Math.round((b.mastered / b.count) * 100) : 0;
                  return (
                    <tr key={b.exam.id}>
                      <td className="dt-name" title={b.exam.name}>
                        <span className="dt-badge"><BankBadge icon={b.exam.icon} color={b.exam.color} name={b.exam.name} size="xs" /></span>
                        {b.exam.name}
                      </td>
                      <td className="mono">{b.count}</td>
                      <td><div className="micro-bar"><i style={{ width: `${mastery}%` }} /></div><span className="mono micro-n">{mastery}%</span></td>
                      <td><div className="micro-bar retain"><i style={{ width: `${b.retention}%` }} /></div><span className="mono micro-n">{b.retention}%</span></td>
                      <td className="mono">{b.attempts ? `${b.best}%` : '—'}</td>
                      <td>{b.due ? <span className="due-badge">{b.due}</span> : <span className="mono" style={{ color: 'var(--faint)' }}>0</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="sec-head" style={{ marginTop: 24 }}>
        <h3>Weak spots</h3>
        {weakRows.length > 0 && <span className="count-badge">{weakRows.length} flagged</span>}
        {weakRows.length > 0 && (
          <div className="sec-actions">
            <button className="btn btn-primary btn-sm" disabled={drilling} onClick={handleDrillAll}>
              <Icon name="bolt" size={14} />{drilling ? 'Preparing…' : 'Drill all weak spots'}
            </button>
          </div>
        )}
      </div>

      {detailLoading ? (
        <p className="chart-empty">Loading…</p>
      ) : weakRows.length === 0 ? (
        <EmptyState
          icon="target"
          title="Nothing flagged as weak"
          desc="Once you have answered questions more than once, the ones you keep missing are collected here with a one-click drill."
        />
      ) : (
        <section className="weak-list">
          {weakRows.map((w) => {
            const pct = Math.round(w.acc * 100);
            const band = w.score > 0.66 ? 'sev-high' : w.score > 0.4 ? 'sev-mid' : 'sev-low';
            return (
              <div className="weak-row rise" key={w.qid}>
                <div className={`weak-score ${band}`}>{pct}%</div>
                <div className="weak-body">
                  <div className="weak-q">{w.question.question}</div>
                  <div className="weak-meta">
                    {w.examName} · {TYPE_LABELS[w.question.type]} · seen {w.seen}× · {w.streak < 0 ? `missed the last ${Math.abs(w.streak)}` : `streak ${w.streak}`}
                    {w.ms ? ` · ~${Math.round(w.ms / 1000)}s each` : ''}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => onDrill(w.examId, weakByBank.get(w.examId) || [w.qid], 'Weak spots', 80)}>
                  <Icon name="bolt" size={13} />Drill
                </button>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
