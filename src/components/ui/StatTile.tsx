import { Icon, IconName } from '../../utils/icons';

interface StatTileProps {
  icon: IconName;
  val: number;
  label: string;
  suffix?: string;
  sub?: string;
}

// Headline number tile — used on Dashboard's stat-grid and Progress's
// stat-grid. Shared so both stay pixel-identical.
export function StatTile({ icon, val, label, suffix, sub }: StatTileProps) {
  return (
    <div className="stat-tile rise">
      <div className="stat-ico"><Icon name={icon} size={17} /></div>
      <div className="stat-num">{val}{suffix || ''}</div>
      <div className="stat-lbl">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
