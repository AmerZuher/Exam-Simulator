export interface ColumnPoint {
  label: string;
  value: number;
  today?: boolean;
  title?: string;
}

interface ColumnChartProps {
  bars: ColumnPoint[];
  height?: number;
  unit?: string;
}

// Simple responsive SVG bar chart — ported from the original's C.columns
// (used for the review forecast), minus the pointer-tracked tooltip system.
export function ColumnChart({ bars, height = 168, unit = '' }: ColumnChartProps) {
  if (!bars.length) return <p className="chart-empty">Nothing to chart yet.</p>;

  const w = 600;
  const padT = 18, padB = 24;
  const n = bars.length;
  const gap = 2;
  const slot = w / n;
  const bw = Math.max(4, slot - gap * 2);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const ih = height - padT - padB;

  return (
    <div className="chart-host">
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} className="chart-svg" preserveAspectRatio="xMidYMid meet">
        <line x1={0} x2={w} y1={padT + ih} y2={padT + ih} className="chart-grid" />
        {bars.map((b, i) => {
          const bh = b.value ? Math.max(3, (b.value / max) * ih) : 0;
          const x = i * slot + (slot - bw) / 2;
          const y = padT + ih - bh;
          const cx = x + bw / 2;
          const edgeMargin = 16;
          const anchor = cx < edgeMargin ? 'start' : cx > w - edgeMargin ? 'end' : 'middle';
          const ax = anchor === 'start' ? i * slot : anchor === 'end' ? (i + 1) * slot : cx;
          return (
            <g key={i} className={`col-g${b.today ? ' today' : ''}`}>
              {bh > 0 && (
                <rect x={x} y={y} width={bw} height={bh} rx={4} className="col-bar" style={{ opacity: 0.35 + 0.65 * (b.value / max) }}>
                  <title>{`${b.title || b.label}: ${b.value} ${unit}`.trim()}</title>
                </rect>
              )}
              {b.value === max && max > 0 && (
                <text x={ax} y={y - 6} className="chart-value" textAnchor={anchor}>{b.value}</text>
              )}
              {b.label && (n <= 8 || i % 2 === 0) && (
                <text x={ax} y={height - 8} className="chart-axis" textAnchor={anchor}>{b.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
