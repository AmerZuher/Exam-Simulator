import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useQuestions } from '../../hooks/useQuestions';
import { useDialog } from '../../hooks/useDialog';
import { useExplanation } from '../../hooks/useExplanation';
import { examsService } from '../../services/examsService';
import { Icon } from '../../utils/icons';
import { BankBadge } from '../ui/BankBadge';
import { MasteryRing } from '../ui/MasteryRing';
import { TypeChip } from '../ui/TypeChip';
import { ScheduleChip } from '../ui/ScheduleChip';
import { EmptyState } from '../ui/EmptyState';
import type { Exam, Question, StudySession } from '../../types/exam';

type FilterKey = 'all' | 'single' | 'multiple' | 'matching' | 'starred' | 'due';

interface StudyProps {
  exam: Exam;
  onBack: () => void;
  onReview: () => void;
  onExam: () => void;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function highlight(text: string, term: string) {
  if (!term.trim()) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

function FilterChip({ value, label, count, active, onClick }: { value: FilterKey; label: string; count: number; active: boolean; onClick: (v: FilterKey) => void }) {
  return (
    <button className={`fchip ${active ? 'on' : ''}`} onClick={() => onClick(value)}>
      {label} <span className="n">{count}</span>
    </button>
  );
}

function QuestionCard({
  q, index, session, term, hidden, revealed, onReveal, onToggleStar,
}: {
  q: Question;
  index: number;
  session?: StudySession;
  term: string;
  hidden: boolean;
  revealed: boolean;
  onReveal: () => void;
  onToggleStar: () => void;
}) {
  const { showExplanation } = useExplanation();
  const mastered = !!session?.mastered;
  const isVeiled = hidden && !revealed;

  const body = q.type === 'matching' ? (
    <div className="match-pairs">
      {q.left_items.map((left, li) => (
        <div className="match-pair" key={li}>
          <div className="mp-l">{highlight(left, term)}</div>
          <div className="mp-arrow"><Icon name="arrowR" size={15} strokeWidth={2.2} /></div>
          <div className="mp-r">{highlight(q.correct_answers[li] || '—', term)}</div>
        </div>
      ))}
    </div>
  ) : (
    <div className="opt-list">
      {q.options.map((opt, oi) => {
        const isCorrect = q.correct_indices.includes(oi);
        return (
          <div className={`opt-row ${isCorrect ? 'is-correct' : ''}`} key={oi}>
            <span className="opt-letter">{isCorrect ? <Icon name="check" size={12} strokeWidth={3} /> : LETTERS[oi % 26]}</span>
            <span>{highlight(opt, term)}</span>
            {isCorrect && <span className="opt-tag t-ok">Answer</span>}
          </div>
        );
      })}
    </div>
  );

  return (
    <article className="card qcard rise">
      <div className="qcard-head">
        <span className="qcard-num">#{index + 1}</span>
        <TypeChip type={q.type} />
        <ScheduleChip session={session} />
        {q.explanation && (
          <button className="icon-btn" title="Why?" aria-label="Show explanation" onClick={() => showExplanation(q)}>
            <Icon name="lightbulb" size={14} />
          </button>
        )}
        <div className="spacer">
          <button
            className={`star-btn no-print ${mastered ? 'on' : ''}`}
            title={mastered ? 'Mastered — click to unmark' : 'Mark as mastered'}
            onClick={onToggleStar}
          >
            <Icon name="star" size={16} />
          </button>
        </div>
      </div>
      <div className="qcard-body">
        <div className="qcard-q">{highlight(q.question, term)}</div>
        {q.images.length > 0 && (
          <div className="qcard-img">
            {q.images.map((src, i) => <img key={i} src={src} alt="" />)}
          </div>
        )}
        {isVeiled ? (
          <div className="veil">
            <div className="veil-target">{body}</div>
            <button className="veil-btn" onClick={onReveal}>
              <span><Icon name="study" size={13} />Reveal answer</span>
            </button>
          </div>
        ) : body}
      </div>
    </article>
  );
}

export function Study({ exam, onBack, onReview, onExam }: StudyProps) {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const { questions, loading } = useQuestions(exam.id);
  const [sessions, setSessions] = useState<Map<string, StudySession>>(new Map());
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sortDue, setSortDue] = useState(false);
  const [hideAnswers, setHideAnswers] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const loadSessions = async () => {
    if (!user) return;
    const rows = await examsService.getStudySessions(user.id, exam.id);
    setSessions(new Map(rows.map((s) => [s.question_id, s])));
  };

  useEffect(() => { loadSessions(); }, [user?.id, exam.id]);

  const counts = useMemo(() => {
    const c = { all: questions.length, single: 0, multiple: 0, matching: 0, starred: 0, due: 0 };
    const now = new Date();
    questions.forEach((q) => {
      c[q.type]++;
      const s = sessions.get(q.id);
      if (s?.mastered) c.starred++;
      if (s?.grade != null && new Date(s.next_review) <= now) c.due++;
    });
    return c;
  }, [questions, sessions]);

  const masteryPct = questions.length ? Math.round((counts.starred / questions.length) * 100) : 0;

  const filtered = useMemo(() => {
    const now = new Date();
    let list = questions.filter((q) => {
      if (filter === 'starred') return !!sessions.get(q.id)?.mastered;
      if (filter === 'due') { const s = sessions.get(q.id); return !!(s?.grade != null && new Date(s.next_review) <= now); }
      if (filter !== 'all') return q.type === filter;
      return true;
    });
    if (term.trim()) {
      const t = term.toLowerCase();
      list = list.filter((q) => (q.question + ' ' + q.options.join(' ') + ' ' + q.left_items.join(' ') + ' ' + q.right_items.join(' ')).toLowerCase().includes(t));
    }
    if (sortDue) {
      list = list.slice().sort((a, b) => {
        const da = sessions.get(a.id)?.grade != null && new Date(sessions.get(a.id)!.next_review) <= now;
        const db = sessions.get(b.id)?.grade != null && new Date(sessions.get(b.id)!.next_review) <= now;
        if (da && !db) return -1;
        if (!da && db) return 1;
        return 0;
      });
    }
    return list;
  }, [questions, sessions, filter, term, sortDue]);

  const toggleStar = async (questionId: string) => {
    if (!user) return;
    const existing = sessions.get(questionId);
    const updated = await examsService.toggleMastered(user.id, exam.id, questionId, existing);
    setSessions(new Map(sessions).set(questionId, updated));
  };

  const revealAll = () => setRevealed(new Set(questions.map((q) => q.id)));

  const resetMastery = async () => {
    if (!user) return;
    const ok = await confirm({
      title: 'Reset all mastery stars?',
      desc: `Every starred question in "${exam.name}" will be unmarked. This doesn't touch your review schedule.`,
      confirmLabel: 'Reset mastery', danger: true,
    });
    if (!ok) return;
    await examsService.resetMastery(user.id, exam.id);
    await loadSessions();
  };

  return (
    <div className="view">
      <section className="card card-pad rise study-head">
        <MasteryRing pct={masteryPct} />
        <div className="sh-txt" style={{ flex: 1, minWidth: 220 }}>
          <div className="sh-title">
            <BankBadge icon={exam.icon} color={exam.color} name={exam.name} size="sm" />
            <h2>{exam.name}</h2>
          </div>
          <div className="sh-meta">
            {questions.length} questions · {counts.starred} mastered
          </div>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="chevL" size={14} />Back</button>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Icon name="print" size={14} />Print / PDF</button>
          <button className="btn btn-soft btn-sm" onClick={onReview}>
            <Icon name="cards" size={13} />Review{counts.due ? <span className="btn-badge">{counts.due}</span> : null}
          </button>
          <button className="btn btn-soft btn-sm" onClick={onExam}><Icon name="play" size={13} />Start exam</button>
        </div>
      </section>

      <section className="study-toolbar rise no-print" style={{ marginTop: 16 }}>
        <div className="search-wrap grow">
          <span className="search-ico"><Icon name="search" size={15} /></span>
          <input className="input" placeholder="Search questions or answers…" value={term} onChange={(e) => setTerm(e.target.value)} />
          <kbd>/</kbd>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <FilterChip value="all" label="All" count={counts.all} active={filter === 'all'} onClick={setFilter} />
          <FilterChip value="single" label="Single" count={counts.single} active={filter === 'single'} onClick={setFilter} />
          <FilterChip value="multiple" label="Multi" count={counts.multiple} active={filter === 'multiple'} onClick={setFilter} />
          <FilterChip value="matching" label="Matching" count={counts.matching} active={filter === 'matching'} onClick={setFilter} />
          <FilterChip value="starred" label="Mastered" count={counts.starred} active={filter === 'starred'} onClick={setFilter} />
          <FilterChip value="due" label="Due" count={counts.due} active={filter === 'due'} onClick={setFilter} />
        </div>
        <button className="btn btn-ghost btn-sm" title="Sort order" onClick={() => setSortDue(!sortDue)}>
          <Icon name={sortDue ? 'bolt' : 'arrowR'} size={13} />{sortDue ? ' Due first' : ' Order'}
        </button>
        <label className="switch" title="Hide answers for self-quiz">
          <input type="checkbox" checked={hideAnswers} onChange={(e) => { setHideAnswers(e.target.checked); setRevealed(new Set()); }} />
          <span className="track" /><span className="thumb" />
        </label>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          <Icon name="eyeOff" size={13} /> Quiz me
        </span>
        <button className="btn btn-ghost btn-sm" onClick={revealAll}><Icon name="study" size={14} />Reveal all</button>
      </section>

      <section style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>Loading questions…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="search" title="No questions match" desc="Try a different search term or filter." />
        ) : (
          filtered.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={i}
              session={sessions.get(q.id)}
              term={term}
              hidden={hideAnswers}
              revealed={revealed.has(q.id)}
              onReveal={() => setRevealed(new Set(revealed).add(q.id))}
              onToggleStar={() => toggleStar(q.id)}
            />
          ))
        )}
      </section>

      <section style={{ marginTop: 26 }} className="no-print">
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <BankBadge icon={exam.icon} color={exam.color} name={exam.name} size="sm" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5 }}>Ready to test yourself?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Launch a timed, shuffled simulation of this bank.</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={resetMastery}>Reset mastery</button>
          <button className="btn btn-primary" onClick={onExam}><Icon name="play" size={15} />Start exam</button>
        </div>
      </section>
    </div>
  );
}
