import { useMemo, useState } from 'react';
import { useGroups } from '../../hooks/useGroups';
import { useExams } from '../../hooks/useExams';
import { useDashboardStats, BankStats } from '../../hooks/useDashboardStats';
import { useDialog } from '../../hooks/useDialog';
import { useLookPicker } from '../../hooks/useLookPicker';
import { useToast } from '../../hooks/useToast';
import { examsService } from '../../services/examsService';
import { Icon, IconName, BANK_TONES } from '../../utils/icons';
import { isSafeUrl } from '../../utils/url';
import { shuffle } from '../../utils/examShared';
import { BankBadge } from '../ui/BankBadge';
import { LinkFavicon } from '../ui/LinkFavicon';
import { MasteryBar } from '../ui/MasteryBar';
import { EmptyState } from '../ui/EmptyState';
import { Select } from '../ui/Select';
import { SectionButton } from '../ui/SectionButton';
import { BankCard } from './Dashboard';
import type { MixedSpec, MixedEntry } from './Exam';
import type { GroupLink } from '../../types/exam';

interface GroupProps {
  groupId: string;
  onBack: () => void;
  onStudy: (examId: string) => void;
  onExam: (examId: string) => void;
  onPracticeBank: (examId: string) => void;
  onStartCustomExam: (spec: MixedSpec) => void;
  onRenamed: (newName: string) => void;
  onImport: () => void;
}

function GroupExamBuilder({ members, onClose, onStart }: { members: BankStats[]; onClose: () => void; onStart: (spec: MixedSpec) => void }) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState('all');
  const [timeLimit, setTimeLimit] = useState('0');
  const [passPct, setPassPct] = useState(70);
  const [shuffleQ, setShuffleQ] = useState(true);
  const [loading, setLoading] = useState(false);

  const toggle = (examId: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(examId)) next.delete(examId); else next.add(examId);
      return next;
    });
  };

  const start = async () => {
    if (!selected.size) { toast('Select at least one bank.', 'err'); return; }
    setLoading(true);
    try {
      const picked = members.filter((m) => selected.has(m.exam.id));
      const perBank = await Promise.all(picked.map(async (m) => {
        let qs = await examsService.getQuestions(m.exam.id);
        if (limit !== 'all') qs = qs.slice(0, parseInt(limit, 10));
        return { exam: m.exam, questions: qs };
      }));

      let entries: MixedEntry[] = [];
      perBank.forEach(({ exam, questions }) => {
        questions.forEach((question) => entries.push({ examId: exam.id, examName: exam.name, question }));
      });
      if (!entries.length) { toast('No questions selected.', 'err'); return; }
      if (shuffleQ) entries = shuffle(entries);

      onStart({
        label: picked.length > 1 ? `Custom exam · ${picked.length} banks` : `Custom exam · ${picked[0].exam.name}`,
        passPct: passPct || 70,
        timeLimit,
        entries,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title"><Icon name="layers" size={16} />Custom exam</div>
            <div className="modal-sub">Pick one or more banks from this group and configure the session.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0 14px', maxHeight: 240, overflowY: 'auto' }}>
          {members.map((m) => (
            <div
              key={m.exam.id}
              className={`build-bank-row${selected.has(m.exam.id) ? ' sel' : ''}`}
              onClick={() => toggle(m.exam.id)}
            >
              <div className="bb-check" />
              <div className="bb-name">{m.exam.name}</div>
              <div className="bb-count">{m.count} q</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-lbl">Questions per bank</label>
            <Select
              value={limit}
              onChange={setLimit}
              options={[
                { value: 'all', label: 'All questions' },
                { value: '10', label: '10 per bank' },
                { value: '20', label: '20 per bank' },
                { value: '50', label: '50 per bank' },
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
                  { value: '0', label: 'No limit' },
                  { value: '1800', label: '30 minutes' },
                  { value: '3600', label: '60 minutes' },
                  { value: '5400', label: '90 minutes' },
                  { value: 'pace', label: '90s per question' },
                ]}
              />
            </div>
            <div>
              <label className="field-lbl">Pass threshold</label>
              <Select
                value={String(passPct)}
                onChange={(v) => setPassPct(parseInt(v, 10))}
                options={[
                  { value: '50', label: '50%' },
                  { value: '70', label: '70%' },
                  { value: '80', label: '80%' },
                  { value: '90', label: '90%' },
                ]}
              />
            </div>
          </div>
          <div className="switch-row">
            <div><div className="sr-txt">Shuffle questions</div><div className="sr-sub">Randomize all question order.</div></div>
            <label className="switch"><input type="checkbox" checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)} /><span className="track" /><span className="thumb" /></label>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={loading} onClick={start}>
            <Icon name="play" size={15} />{loading ? 'Preparing…' : 'Start custom exam'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberPickerModal({
  groupId, onClose, onSaved, onImport,
}: { groupId: string; onClose: () => void; onSaved: () => void; onImport: () => void }) {
  const { exams, updateExam } = useExams();
  const toast = useToast();
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    exams.forEach((e) => { init[e.id] = e.group_id === groupId; });
    return init;
  });
  const [search, setSearch] = useState('');

  const filtered = exams.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  const save = async () => {
    await Promise.all(
      exams.map((e) => {
        const shouldBeIn = !!checked[e.id];
        const isIn = e.group_id === groupId;
        if (shouldBeIn && !isIn) return updateExam(e.id, { group_id: groupId });
        if (!shouldBeIn && isIn) return updateExam(e.id, { group_id: null });
        return Promise.resolve();
      })
    );
    toast('Group membership updated.', 'ok');
    onSaved();
    onClose();
  };

  return (
    <div className="modal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Manage banks</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={15} /></button>
        </div>
        {exams.length > 6 && (
          <input className="input" placeholder="Filter banks…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 10 }} autoFocus />
        )}
        <div className="gmember-list">
          {filtered.length === 0 ? (
            exams.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '4px 2px 14px' }}>
                <div className="glink-empty" style={{ padding: 0 }}>No exam banks yet.</div>
                <button className="btn btn-primary btn-sm" onClick={onImport}><Icon name="upload" size={13} />Import a bank</button>
              </div>
            ) : (
              <div className="glink-empty">No banks match "{search}".</div>
            )
          ) : (
            filtered.map((e) => (
              <label key={e.id} className={`gmember-row${checked[e.id] ? ' on' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!checked[e.id]}
                  onChange={(ev) => setChecked((c) => ({ ...c, [e.id]: ev.target.checked }))}
                />
                <BankBadge icon={e.icon} color={e.color} name={e.name} size="sm" />
                <span className="gmember-name">{e.name}</span>
                {e.group_id && e.group_id !== groupId && <span className="gmember-note">in another group</span>}
                <span className="gmember-check"><Icon name="check" size={12} strokeWidth={3} /></span>
              </label>
            ))
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}><Icon name="check" size={15} />Save</button>
        </div>
      </div>
    </div>
  );
}

export function Group({ groupId, onBack, onStudy, onExam, onPracticeBank, onStartCustomExam, onRenamed, onImport }: GroupProps) {
  const { groups, updateGroup, deleteGroup, setGroupLinks } = useGroups();
  const { banks, refetch } = useDashboardStats();
  const { confirm, promptFields } = useDialog();
  const { pickLook } = useLookPicker();
  const toast = useToast();
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  const group = groups.find((g) => g.id === groupId);
  const members = useMemo(() => banks.filter((b) => b.exam.group_id === groupId), [banks, groupId]);

  if (!group) {
    return (
      <div className="view">
        <EmptyState icon="layers" title="Group not found" desc="This group may have been deleted." actions={<button className="btn btn-primary" onClick={onBack}><Icon name="home" size={15} />Dashboard</button>} />
      </div>
    );
  }

  const questions = members.reduce((s, b) => s + b.count, 0);
  const mastered = members.reduce((s, b) => s + b.mastered, 0);
  const masteryPct = questions ? Math.round((mastered / questions) * 100) : 0;
  const retentionWeighted = members.reduce((s, b) => s + b.retention * b.count, 0);
  const retention = questions ? Math.round(retentionWeighted / questions) : 0;

  const handleEdit = async () => {
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
      if (newName !== group.name) onRenamed(newName);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update the group.', 'err');
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete "${group.name}"?`,
      desc: members.length
        ? `Its ${members.length} member bank${members.length > 1 ? 's' : ''} will move back to the ungrouped Exam banks list. This does not delete any banks.`
        : 'This group has no member banks.',
      confirmLabel: 'Delete group', danger: true,
    });
    if (!ok) return;
    await deleteGroup(group.id);
    toast('Group deleted.', 'info');
    onBack();
  };

  const handleAddLink = async () => {
    const result = await promptFields({
      title: 'Add link',
      fields: [
        { key: 'label', label: 'Label', placeholder: 'e.g. Course notes', required: true },
        { key: 'url', label: 'URL', placeholder: 'https://…', required: true },
      ],
      confirmLabel: 'Add link',
    });
    if (!result) return;
    const url = result.url.trim();
    if (!isSafeUrl(url)) { toast('Enter a valid http:// or https:// URL.', 'err'); return; }
    const newLink = { id: crypto.randomUUID(), label: result.label.trim(), url };
    await setGroupLinks(group.id, [...group.links, newLink]);
    toast('Link added.', 'ok');
  };

  const handleEditLink = async (link: GroupLink) => {
    const result = await promptFields({
      title: 'Edit link',
      fields: [
        { key: 'label', label: 'Label', value: link.label, placeholder: 'e.g. Course notes', required: true },
        { key: 'url', label: 'URL', value: link.url, placeholder: 'https://…', required: true },
      ],
      confirmLabel: 'Save',
    });
    if (!result) return;
    const url = result.url.trim();
    if (!isSafeUrl(url)) { toast('Enter a valid http:// or https:// URL.', 'err'); return; }
    await setGroupLinks(group.id, group.links.map((l) => (l.id === link.id ? { ...l, label: result.label.trim(), url } : l)));
    toast('Link updated.', 'ok');
  };

  const handleRemoveLink = async (linkId: string) => {
    await setGroupLinks(group.id, group.links.filter((l) => l.id !== linkId));
    toast('Link removed.', 'info');
  };

  return (
    <div className="view">
      <section className="card card-pad rise" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <BankBadge icon={group.icon} color={group.color} logo={group.logo} name={group.name} size="lg" />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>{group.name}</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, margin: '4px 0 0' }}>
            {group.description || 'No description added.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleEdit}><Icon name="edit" size={14} />Edit</button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}><Icon name="trash" size={14} />Delete</button>
        </div>

        <div style={{ width: '100%', marginTop: 6 }}>
          <MasteryBar masteryPct={masteryPct} retentionPct={retention} />
        </div>
      </section>

      <div className="sec-head" style={{ marginTop: 24 }}>
        <h3>Links</h3>
        {group.links.length > 0 && <span className="count-badge">{group.links.length}</span>}
        <div className="sec-actions">
          <SectionButton icon="link" onClick={handleAddLink}>Add link</SectionButton>
        </div>
      </div>
      {group.links.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>No links yet.</p>
      ) : (
        <div className="glinks-grid">
          {group.links.map((l) => (
            <div className="glink-row glink-tile" style={{ paddingRight: 56 }} key={l.id}>
              <a className="glink-open" href={l.url} target="_blank" rel="noopener noreferrer">
                <LinkFavicon url={l.url} size={22} />
                <span className="glink-info">
                  <span className="glink-label">{l.label}</span>
                  <span className="glink-url">{l.url}</span>
                </span>
              </a>
              <span className="glink-remove" style={{ width: 'auto', display: 'flex', gap: 2 }}>
                <button className="icon-btn" style={{ width: 22, height: 22 }} title="Edit link" aria-label={`Edit ${l.label}`} onClick={() => handleEditLink(l)}>
                  <Icon name="edit" size={11} />
                </button>
                <button className="icon-btn" style={{ width: 22, height: 22 }} title="Remove link" aria-label={`Remove ${l.label}`} onClick={() => handleRemoveLink(l.id)}>
                  <Icon name="x" size={12} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="sec-head" style={{ marginTop: 30 }}>
        <h3>Member banks</h3>
        <span className="count-badge">{members.length} total</span>
        <div className="sec-actions">
          {members.length > 0 && (
            <SectionButton icon="play" onClick={() => setBuilderOpen(true)}>Custom exam</SectionButton>
          )}
          <SectionButton icon="layers" onClick={() => setMemberPickerOpen(true)}>Manage banks</SectionButton>
        </div>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon="book"
          title="No banks in this group"
          desc="Add exam banks to this group to track their combined progress."
          actions={<button className="btn btn-primary" onClick={() => setMemberPickerOpen(true)}><Icon name="layers" size={15} />Manage banks</button>}
        />
      ) : (
        <div className="bank-grid">
          {members.map((stat) => (
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

      {memberPickerOpen && (
        <MemberPickerModal
          groupId={group.id} onClose={() => setMemberPickerOpen(false)} onSaved={refetch}
          onImport={() => { setMemberPickerOpen(false); onImport(); }}
        />
      )}

      {builderOpen && (
        <GroupExamBuilder members={members} onClose={() => setBuilderOpen(false)} onStart={(spec) => { setBuilderOpen(false); onStartCustomExam(spec); }} />
      )}
    </div>
  );
}
