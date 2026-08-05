import { useEffect, useMemo, useRef, useState, MouseEvent as ReactMouseEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useExams } from '../../hooks/useExams';
import { useGroups } from '../../hooks/useGroups';
import { useProfile } from '../../hooks/useProfile';
import { useDashboardStats, BankStats } from '../../hooks/useDashboardStats';
import { useDialog } from '../../hooks/useDialog';
import { useLookPicker } from '../../hooks/useLookPicker';
import { useToast } from '../../hooks/useToast';
import { examsService } from '../../services/examsService';
import { Icon, IconName, BANK_TONES } from '../../utils/icons';
import { BankBadge } from '../ui/BankBadge';
import { Sparkline } from '../ui/Sparkline';
import { EmptyState } from '../ui/EmptyState';
import { LinkFavicon } from '../ui/LinkFavicon';
import { MasteryBar } from '../ui/MasteryBar';
import { StatTile } from '../ui/StatTile';
import { LoadingState } from '../ui/LoadingState';
import { SectionButton } from '../ui/SectionButton';
import type { ExamGroup } from '../../types/exam';

interface DashboardProps {
  onStudy: (examId: string) => void;
  onExam: (examId: string) => void;
  onPracticeBank: (examId: string) => void;
  onReviewBank: (examId: string) => void;
  onImport: () => void;
  onGenerator: () => void;
  onProgress: () => void;
  onGroup: (groupId: string) => void;
}

interface PlanCard {
  key: string;
  icon: IconName;
  tone: 'acc' | 'warn' | 'teal' | 'ok';
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}

function TodayStrip({ stats, dailyGoal, onReviewDue, onStudyAhead }: {
  stats: ReturnType<typeof useDashboardStats>['global'];
  dailyGoal: number;
  onReviewDue: () => void;
  onStudyAhead: () => void;
}) {
  const pct = Math.min(100, Math.round((stats.todayAnswered / dailyGoal) * 100));
  return (
    <section className="today-strip rise" style={{ animationDelay: '.04s' }}>
      <div className={`ts-flame${stats.streak ? ' lit' : ''}`}>
        <Icon name="flame" size={20} />
        <span className="ts-streak">{stats.streak}</span>
      </div>
      <div className="ts-body">
        <div className="ts-t">
          {stats.streak > 1 ? `${stats.streak}-day streak` : stats.streak === 1 ? 'Streak started today' : 'No streak yet'}
        </div>
        <div className="ts-s">
          {stats.todayAnswered} of {dailyGoal} questions today
          {stats.due ? ` · ${stats.due} card${stats.due === 1 ? '' : 's'} due` : ' · nothing due'}
        </div>
        <div className="ts-track"><i style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="ts-actions">
        {stats.due ? (
          <button className="btn btn-primary btn-sm" onClick={onReviewDue}><Icon name="cards" size={14} />Start review</button>
        ) : (
          <button className="btn btn-soft btn-sm" onClick={onStudyAhead}><Icon name="cards" size={14} />Study ahead</button>
        )}
      </div>
    </section>
  );
}

function PlanGrid({ cards }: { cards: PlanCard[] }) {
  if (!cards.length) return null;
  return (
    <div className="plan-grid">
      {cards.map((c, i) => (
        <article key={c.key} className={`plan-card tone-${c.tone} rise`} style={{ animationDelay: `${0.05 + i * 0.05}s` }}>
          <div className="pc-ico"><Icon name={c.icon} size={18} /></div>
          <div className="pc-t">{c.title}</div>
          <div className="pc-d">{c.desc}</div>
          <button className="btn btn-soft btn-sm" onClick={c.onClick}>{c.cta}<Icon name="arrowR" size={13} /></button>
        </article>
      ))}
    </div>
  );
}

export function BankCard({
  stat, onStudy, onExam, onPracticeBank, onRenamed, onDeleted, onLookChanged,
}: {
  stat: BankStats;
  onStudy: (id: string) => void;
  onExam: (id: string) => void;
  onPracticeBank: (id: string) => void;
  onRenamed: () => void;
  onDeleted: () => void;
  onLookChanged: () => void;
}) {
  const { exam, count, types, attempts, best, mastered, retention } = stat;
  const { exams, updateExam, deleteExam } = useExams();
  const { confirm, prompt } = useDialog();
  const { pickLook } = useLookPicker();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const masteryPct = count ? Math.round((mastered / count) * 100) : 0;
  const sparkVals = stat.history.slice(-10).map((a) => a.pct);

  const handleRename = async () => {
    setMenuOpen(false);
    const v = await prompt({ title: 'Rename bank', desc: 'Give this question bank a new name.', value: exam.name, confirmLabel: 'Rename' });
    if (!v) return;
    if (exams.some((e) => e.id !== exam.id && e.name.trim().toLowerCase() === v.trim().toLowerCase())) {
      toast(`You already have a bank named "${v}" — pick a different name.`, 'err');
      return;
    }
    await updateExam(exam.id, { name: v });
    toast(`Bank renamed to "${v}".`, 'ok');
    onRenamed();
  };

  const handleChangeIcon = async () => {
    setMenuOpen(false);
    const result = await pickLook({
      title: 'Bank icon', subtitle: exam.name,
      icon: (exam.icon as IconName) || 'grad', tone: (exam.color as (typeof BANK_TONES)[number]) || 'acc',
      allowUpload: false,
    });
    if (!result) return;
    await updateExam(exam.id, { icon: result.icon || undefined, color: result.tone });
    toast('Icon updated.', 'ok');
    onLookChanged();
  };

  const handleExport = () => {
    setMenuOpen(false);
    (async () => {
      const questions = await examsService.getQuestions(exam.id);
      const blob = new Blob([JSON.stringify({ name: exam.name, exportedAt: new Date().toISOString(), questions }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exam.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Bank exported as JSON.', 'ok');
    })();
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: `Delete "${exam.name}"?`,
      desc: 'The bank, its attempt history and mastery progress will be permanently removed.',
      confirmLabel: 'Delete bank', danger: true,
    });
    if (!ok) return;
    await deleteExam(exam.id);
    toast('Bank deleted.', 'info');
    onDeleted();
  };

  return (
    <article className="card card-hover bank-card rise">
      <div className="bank-top">
        <BankBadge icon={exam.icon} color={exam.color} name={exam.name} />
        <div style={{ minWidth: 0 }}>
          <div className="bank-name">{exam.name}</div>
          <div className="bank-meta">
            {count} questions{attempts ? ` · ${attempts} attempt${attempts > 1 ? 's' : ''}` : ' · not attempted yet'}
          </div>
        </div>
        <div className="bank-menu" ref={menuRef}>
          <button className="icon-btn" aria-label="Bank options" onClick={() => setMenuOpen((o) => !o)}>
            <Icon name="dots" size={16} />
          </button>
          {menuOpen && (
            <div className="menu-pop">
              <button className="menu-item" onClick={handleRename}><Icon name="edit" size={14} />Rename bank</button>
              <button className="menu-item" onClick={handleChangeIcon}><Icon name="palette" size={14} />Change icon</button>
              <button className="menu-item" onClick={handleExport}><Icon name="download" size={14} />Export as JSON</button>
              <button className="menu-item danger" onClick={handleDelete}><Icon name="trash" size={14} />Delete bank</button>
            </div>
          )}
        </div>
      </div>

      <div className="type-chips">
        {types.single > 0 && <span className="chip chip-acc">{types.single} single</span>}
        {types.multiple > 0 && <span className="chip chip-warn">{types.multiple} multi</span>}
        {types.matching > 0 && <span className="chip chip-teal">{types.matching} match</span>}
      </div>

      <MasteryBar masteryPct={masteryPct} retentionPct={retention} title={`Mastery: ${mastered} of ${count} starred · Retention: questions scheduled a week or more out`} />

      <div className="bank-foot">
        <div className="bank-best">
          {attempts ? (
            <>
              <Icon name="target" size={14} />
              <span>Best&nbsp;<b style={{ color: 'var(--ink)' }}>{best}%</b></span>
              {sparkVals.length > 1 && <span style={{ marginLeft: 4 }}><Sparkline values={sparkVals} w={72} h={22} /></span>}
            </>
          ) : (
            <>
              <Icon name="sparkle" size={14} />
              <span>Ready when you are</span>
            </>
          )}
        </div>
        <div className="bank-actions">
          <button className="icon-btn" title="Q&A preview" aria-label={`Study ${exam.name}`} onClick={() => onStudy(exam.id)}>
            <Icon name="study" size={15} />
          </button>
          <button className="btn btn-soft btn-sm" onClick={() => onPracticeBank(exam.id)}><Icon name="brain" size={13} />Practice</button>
          <button className="btn btn-primary btn-sm" onClick={() => onExam(exam.id)}><Icon name="play" size={13} />Exam</button>
        </div>
      </div>
    </article>
  );
}

function GroupCard({ group, banks, onOpen }: { group: ExamGroup; banks: BankStats[]; onOpen: () => void }) {
  const { groups, updateGroup } = useGroups();
  const { pickLook } = useLookPicker();
  const toast = useToast();
  const members = banks.filter((b) => b.exam.group_id === group.id);
  const questions = members.reduce((s, b) => s + b.count, 0);
  const mastered = members.reduce((s, b) => s + b.mastered, 0);
  const masteryPct = questions ? Math.round((mastered / questions) * 100) : 0;
  const retentionWeighted = members.reduce((s, b) => s + b.retention * b.count, 0);
  const retention = questions ? Math.round(retentionWeighted / questions) : 0;

  const handleEdit = async (e: ReactMouseEvent) => {
    e.stopPropagation();
    const result = await pickLook({
      title: 'Edit group', subtitle: group.name,
      icon: (group.icon as IconName) || 'layers', tone: (group.color as (typeof BANK_TONES)[number]) || 'acc',
      logo: group.logo,
      allowUpload: true,
      nameField: true, nameValue: group.name,
      descField: true, descValue: group.description || '',
    });
    if (!result) return;
    const newName = result.name?.trim() || group.name;
    if (groups.some((g) => g.id !== group.id && g.name.trim().toLowerCase() === newName.toLowerCase())) {
      toast(`You already have a group named "${newName}" — pick a different name.`, 'err');
      return;
    }
    try {
      await updateGroup(group.id, {
        name: newName,
        description: result.description?.trim() || '',
        icon: result.logo ? undefined : (result.icon || undefined),
        color: result.tone,
        logo: result.logo,
      });
      toast('Group updated.', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update the group.', 'err');
    }
  };

  return (
    <article className="card card-hover group-card rise">
      <div className="bank-top">
        <BankBadge icon={group.icon} color={group.color} logo={group.logo} name={group.name} />
        <div style={{ minWidth: 0 }}>
          <div className="bank-name">{group.name}</div>
          <div className="group-meta-row">
            <span className="group-meta-item"><Icon name="book" size={12} strokeWidth={2.2} /><b>{members.length}</b> exam{members.length === 1 ? '' : 's'}</span>
            <span className="group-meta-item"><Icon name="layers" size={12} strokeWidth={2.2} /><b>{questions}</b> question{questions === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="bank-menu">
          <button className="icon-btn" title="Edit group" aria-label="Edit group" onClick={handleEdit}>
            <Icon name="edit" size={15} />
          </button>
        </div>
      </div>
      <div className={`group-desc${group.description ? '' : ' is-blank'}`}>{group.description || 'No description added.'}</div>
      <MasteryBar masteryPct={masteryPct} retentionPct={retention} title="Combined mastery and retention across every bank in this group" />
      <div className="bank-foot">
        <div className="group-links-row">
          {group.links.map((l) => (
            <a key={l.id} className="group-link-pill" href={l.url} target="_blank" rel="noopener noreferrer" title={l.label}>
              <LinkFavicon url={l.url} size={13} />{l.label}
            </a>
          ))}
        </div>
        <div className="bank-actions">
          <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onOpen}>
            <Icon name="arrowR" size={13} />Open group
          </button>
        </div>
      </div>
    </article>
  );
}

export function Dashboard({ onStudy, onExam, onPracticeBank, onReviewBank, onImport, onGenerator, onProgress, onGroup }: DashboardProps) {
  const { user } = useAuth();
  const { loading, global, banks, refetch } = useDashboardStats();
  const { groups, createGroup } = useGroups();
  const { profile } = useProfile();
  const { pickLook } = useLookPicker();
  const toast = useToast();

  const dailyGoal = profile?.daily_goal || 20;
  const ungrouped = useMemo(() => banks.filter((b) => !b.exam.group_id), [banks]);

  const planCards = useMemo<PlanCard[]>(() => {
    const cards: PlanCard[] = [];

    const dueBank = banks.filter((b) => b.due > 0).sort((a, b) => b.due - a.due)[0];
    if (dueBank) {
      cards.push({
        key: 'due', icon: 'cards', tone: 'acc',
        title: `${dueBank.due} cards due`,
        desc: `in ${dueBank.exam.name} — the scheduler picked these for today.`,
        cta: 'Review now', onClick: () => onReviewBank(dueBank.exam.id),
      });
    }

    if (global.weak >= 3) {
      cards.push({
        key: 'weak', icon: 'bolt', tone: 'warn',
        title: `${global.weak} weak spots`,
        desc: 'Questions you keep getting wrong across your banks.',
        cta: 'See progress', onClick: onProgress,
      });
    }

    const untouched = banks.find((b) => b.attempts === 0);
    if (untouched) {
      cards.push({
        key: 'untouched', icon: 'play', tone: 'teal',
        title: 'Never examined',
        desc: `${untouched.exam.name} has no attempts yet — get a baseline score.`,
        cta: 'Take it', onClick: () => onExam(untouched.exam.id),
      });
    } else {
      const lowest = banks.filter((b) => b.attempts > 0).sort((a, b) => a.best - b.best)[0];
      if (lowest) {
        cards.push({
          key: 'lowest', icon: 'target', tone: 'teal',
          title: `Lowest best score: ${lowest.best}%`,
          desc: `${lowest.exam.name} is your weakest bank overall.`,
          cta: 'Retake', onClick: () => onExam(lowest.exam.id),
        });
      }
    }

    if (!cards.length && banks.length) {
      cards.push({
        key: 'caught-up', icon: 'check', tone: 'ok',
        title: 'All caught up',
        desc: 'Nothing due, nothing flagged. Study ahead or import something new.',
        cta: 'Import', onClick: onImport,
      });
    }

    return cards;
  }, [banks, global.weak]);

  const handleNewGroup = async () => {
    const result = await pickLook({
      title: 'New exam group', subtitle: 'e.g. a certification track',
      icon: 'layers', tone: 'acc',
      allowUpload: true,
      nameField: true, nameValue: '',
      descField: true, descValue: '',
    });
    if (!result) return;
    const name = result.name?.trim();
    if (!name) return;
    if (groups.some((g) => g.name.trim().toLowerCase() === name.toLowerCase())) {
      toast(`You already have a group named "${name}" — pick a different name.`, 'err');
      return;
    }
    try {
      await createGroup(name, {
        description: result.description?.trim() || undefined,
        icon: result.logo ? undefined : (result.icon || undefined),
        color: result.tone,
        logo: result.logo,
      });
      toast(`Group "${name}" created.`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create the group.', 'err');
    }
  };

  if (loading) {
    return (
      <div className="view">
        <LoadingState label="Loading your exam banks…" />
      </div>
    );
  }

  return (
    <div className="view">
      <section className="hero rise">
        <span className="hero-kicker"><Icon name="bolt" size={13} strokeWidth={2.2} />Exam Simulator Suite</span>
        <h2>Practice. Preview. Master every question.</h2>
        <p>
          Import markdown question banks, drill them in the interactive simulator, or flip open the
          instant Q&amp;A study preview — with attempt history, mastery tracking and smart parsing built in.
        </p>
        <div className="hero-actions">
          <button className="btn btn-light" onClick={onImport}><Icon name="upload" size={16} />Import question bank</button>
          <button className="btn btn-ghost" onClick={handleNewGroup}><Icon name="layers" size={16} />Create group</button>
          <button className="btn btn-ghost" onClick={onGenerator}><Icon name="robot" size={16} />Generate with AI</button>
        </div>
      </section>

      <div style={{ marginTop: 18 }}>
        <TodayStrip
          stats={global}
          dailyGoal={dailyGoal}
          onReviewDue={() => { const target = banks.find((b) => b.due > 0); if (target) onReviewBank(target.exam.id); }}
          onStudyAhead={onProgress}
        />
      </div>

      <section className="stat-grid" style={{ marginTop: 22 }}>
        <StatTile icon="book" val={global.banks} label="Exam banks" />
        <StatTile icon="layers" val={global.questions} label="Total questions" />
        <StatTile icon="chart" val={global.attempts} label="Attempts taken" />
        <StatTile icon="target" val={global.avg} label="Average score" suffix="%" />
      </section>

      {banks.length > 0 && (
        <>
          <div className="sec-head" style={{ marginTop: 26 }}>
            <h3>Today</h3>
            <div className="sec-actions">
              <SectionButton icon="chart" onClick={onProgress}>Full progress</SectionButton>
            </div>
          </div>
          <PlanGrid cards={planCards} />
        </>
      )}

      <div className="sec-head" style={{ marginTop: 34 }}>
        <h3>Exam Groups</h3>
        {groups.length > 0 && <span className="count-badge">{groups.length} total</span>}
        <div className="sec-actions">
          <SectionButton icon="layers" onClick={handleNewGroup}>New group</SectionButton>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No exam groups yet"
          desc="Bundle related exam banks — like everything under one certification track — into a group with shared progress and reference links."
          actions={<button className="btn btn-primary" onClick={handleNewGroup}><Icon name="layers" size={15} />Create a group</button>}
        />
      ) : (
        <div className="group-grid">
          {groups.map((g) => <GroupCard key={g.id} group={g} banks={banks} onOpen={() => onGroup(g.id)} />)}
        </div>
      )}

      <div className="sec-head" style={{ marginTop: 34 }}>
        <h3>Exam banks</h3>
        <span className="count-badge">{ungrouped.length} total</span>
        <div className="sec-actions">
          <SectionButton icon="upload" onClick={onImport}>Import</SectionButton>
        </div>
      </div>

      {banks.length === 0 ? (
        <EmptyState
          icon="book"
          title="No question banks yet"
          desc="Use the importer to paste or upload markdown/JSON questions and build your first bank."
          actions={<button className="btn btn-primary" onClick={onImport}><Icon name="upload" size={15} />Open importer</button>}
        />
      ) : ungrouped.length === 0 ? (
        <EmptyState
          icon="check"
          title="All banks are organized into groups"
          desc="Every exam bank you have belongs to a group above. Remove one from its group to see it here."
          actions={<button className="btn btn-ghost" onClick={onImport}><Icon name="upload" size={15} />Import another bank</button>}
        />
      ) : (
        <div className="bank-grid">
          {ungrouped.map((stat) => (
            <BankCard
              key={stat.exam.id}
              stat={stat}
              onStudy={onStudy}
              onExam={onExam}
              onPracticeBank={onPracticeBank}
              onRenamed={refetch}
              onDeleted={refetch}
              onLookChanged={refetch}
            />
          ))}
        </div>
      )}

      {!user && (
        <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
          Sign in to save your progress across sessions.
        </div>
      )}
    </div>
  );
}
