import { Icon, IconName } from '../../utils/icons';
import { useProfile } from '../../hooks/useProfile';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onHamburgerClick?: () => void;
  onCommandClick?: () => void;
  onUserClick?: () => void;
  showTimer?: boolean;
  timerValue?: string;
  onTimerPause?: () => void;
}

function UserChip({ onClick }: { onClick?: () => void }) {
  const { user } = useAuth();
  const { profile } = useProfile();
  if (!user) return null;

  const name = profile?.full_name?.trim() || user.email?.split('@')[0] || 'Account';
  const firstName = name.split(' ')[0];

  return (
    <button className="user-chip" onClick={onClick} title={name} aria-label={`${name} — open settings`}>
      <span className="user-chip-avatar">
        {profile?.avatar_url && !profile.avatar_url.startsWith('icon:') ? (
          <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
        ) : (
          <Icon name={(profile?.avatar_url?.startsWith('icon:') ? profile.avatar_url.slice(5) : 'user') as IconName} size={13} strokeWidth={2.2} />
        )}
      </span>
      <span className="user-chip-name">{firstName}</span>
    </button>
  );
}

export function Header({
  title,
  subtitle,
  onHamburgerClick,
  onCommandClick,
  onUserClick,
  showTimer = false,
  timerValue = '00:00:00',
  onTimerPause,
}: HeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-lead">
        <button
          className="icon-btn hamburger"
          onClick={onHamburgerClick}
          aria-label="Open menu"
        >
          <Icon name="menu" size={17} strokeWidth={2} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="topbar-title">{title}</div>
          {subtitle && <div className="topbar-sub">{subtitle}</div>}
        </div>
      </div>

      <button
        className="cmdk-btn"
        onClick={onCommandClick}
        title="Search everything (Ctrl+K)"
      >
        <Icon name="search" size={15} strokeWidth={2} className="cmdk-ico" />
        <span className="cmdk-lbl">Search banks, questions and actions…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="topbar-actions">
        {showTimer && (
          <div className="timer-pill">
            <span className="timer-dot" />
            <span className="timer-clock mono">{timerValue}</span>
            <button
              className="timer-pause"
              onClick={onTimerPause}
              title="Pause / resume exam"
              aria-label="Pause or resume exam"
            >
              <Icon name="pause" size={12} strokeWidth={2} />
            </button>
          </div>
        )}
        <UserChip onClick={onUserClick} />
      </div>
    </header>
  );
}
