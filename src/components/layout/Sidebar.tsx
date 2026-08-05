import { Icon, IconName } from '../../utils/icons';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { useProfile } from '../../hooks/useProfile';
import { useExams } from '../../hooks/useExams';
import { useGroups } from '../../hooks/useGroups';
import { BankBadge } from '../ui/BankBadge';
import { LinkFavicon } from '../ui/LinkFavicon';

interface SidebarProps {
  activeName: string;
  activeGroupId?: string;
  isOpen: boolean;
  isCollapsed: boolean;
  onBrandClick: () => void;
  onCollapseToggle: () => void;
  onDashboard: () => void;
  onReview: () => void;
  onProgress: () => void;
  onImport: () => void;
  onGenerator: () => void;
  onSettings: () => void;
  onGroup: (groupId: string) => void;
  onStudy: (examId: string) => void;
}

export function Sidebar({
  activeName, activeGroupId, isOpen, isCollapsed,
  onBrandClick, onCollapseToggle,
  onDashboard, onReview, onProgress, onImport, onGenerator, onSettings, onGroup, onStudy,
}: SidebarProps) {
  const { global } = useDashboardStats();
  const { profile } = useProfile();
  const { exams } = useExams();
  const { groups } = useGroups();

  const links = profile?.sidebar_links || [];
  const examByKey = (key: string) => exams.find((e) => e.id === key || e.name === key);
  const groupByKey = (key: string) => groups.find((g) => g.id === key || g.name === key);

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`} id="sidebar">
      <div className="brand">
        <button className="brand-badge" id="brand-btn" onClick={onBrandClick} aria-label="Open settings">
          <Icon name="logo" size={20} strokeWidth={2} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="brand-name">ExamPro</div>
          <div className="brand-sub">Study &amp; Simulate</div>
        </div>
      </div>

      <nav id="side-nav" style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        <button className={`nav-item${activeName === 'dashboard' ? ' active' : ''}`} onClick={onDashboard}>
          <span className="nav-ico"><Icon name="dashboard" size={17} /></span>
          <span>Dashboard</span>
          <span className="nav-pill">{global.banks}</span>
        </button>
        <button className={`nav-item${activeName === 'review' ? ' active' : ''}`} onClick={onReview}>
          <span className="nav-ico"><Icon name="cards" size={17} /></span>
          <span>Review</span>
          {global.due > 0 && <span className="nav-pill pill-due">{global.due}</span>}
        </button>
        <button className={`nav-item${activeName === 'progress' ? ' active' : ''}`} onClick={onProgress}>
          <span className="nav-ico"><Icon name="chart" size={17} /></span>
          <span>Progress</span>
          {global.streak > 0 && (
            <span className="nav-pill pill-streak"><Icon name="flame" size={9} strokeWidth={2.4} />{global.streak}</span>
          )}
        </button>
        <button className={`nav-item${activeName === 'import' ? ' active' : ''}`} onClick={onImport}>
          <span className="nav-ico"><Icon name="upload" size={17} /></span>
          <span>Import bank</span>
        </button>
        <button className={`nav-item${activeName === 'generator' ? ' active' : ''}`} onClick={onGenerator}>
          <span className="nav-ico"><Icon name="robot" size={17} /></span>
          <span>AI Generator</span>
        </button>
        <button className={`nav-item${activeName === 'settings' ? ' active' : ''}`} onClick={onSettings}>
          <span className="nav-ico"><Icon name="gear" size={17} /></span>
          <span>Settings</span>
        </button>

        {links.length > 0 && (
          <>
            <div className="nav-label">Shortcuts</div>
            {links.map((l) => {
              if (l.type === 'group') {
                const g = l.groupName ? groupByKey(l.groupName) : undefined;
                if (!g) return null;
                return (
                  <button
                    key={l.id}
                    className={`nav-item${activeName === 'group' && activeGroupId === g.id ? ' active' : ''}`}
                    onClick={() => onGroup(g.id)}
                  >
                    <span className="nav-ico"><BankBadge icon={g.icon} color={g.color} logo={g.logo} name={g.name} size="xs" /></span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  </button>
                );
              }
              if (l.type === 'bank') {
                const e = l.bankKey ? examByKey(l.bankKey) : undefined;
                if (!e) return null;
                const modeIcon: IconName = l.mode === 'exam' ? 'play' : l.mode === 'practice' ? 'brain' : 'study';
                return (
                  <button key={l.id} className="nav-item" onClick={() => onStudy(e.id)}>
                    <span className="nav-ico"><BankBadge icon={e.icon} color={e.color} name={e.name} size="xs" /></span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                    <span className="nav-mode-ico"><Icon name={modeIcon} size={13} /></span>
                  </button>
                );
              }
              return (
                <a key={l.id} className="nav-item" href={l.url} target="_blank" rel="noopener noreferrer">
                  <span className="nav-ico">{l.url ? <LinkFavicon url={l.url} size={22} /> : <Icon name="link" size={17} />}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
                </a>
              );
            })}
          </>
        )}
      </nav>

      <div className="sidebar-foot">
        <button className="collapse-btn" onClick={onCollapseToggle} title="Collapse sidebar" aria-label="Toggle sidebar">
          <Icon name="chevL" size={16} strokeWidth={2.2} className="collapse-ico" />
          <span className="collapse-lbl">{isCollapsed ? 'Expand' : 'Collapse'}</span>
        </button>
      </div>
    </aside>
  );
}
