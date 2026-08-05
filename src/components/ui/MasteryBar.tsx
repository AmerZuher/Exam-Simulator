interface MasteryBarProps {
  masteryPct: number;
  retentionPct: number;
  title?: string;
}

// Dual-track mastery/retention bar — used on bank cards, group cards, and
// the group/bank detail headers. Kept as one shared component so all three
// stay pixel-identical instead of drifting apart.
export function MasteryBar({ masteryPct, retentionPct, title }: MasteryBarProps) {
  return (
    <div title={title || `Mastery ${masteryPct}% · Retention ${retentionPct}%`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>
        <span>Mastery {masteryPct}%</span><span>Retention {retentionPct}%</span>
      </div>
      <div className="mastery-bar">
        <i style={{ width: `${masteryPct}%` }} />
        <b className="retain-mark" style={{ left: `${retentionPct}%` }} />
      </div>
    </div>
  );
}
