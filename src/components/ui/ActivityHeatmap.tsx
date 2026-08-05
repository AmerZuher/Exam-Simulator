import { formatTime } from '../../utils/parser';

export interface HeatmapDay {
  ts: number;
  answered: number;
  seconds: number;
}

interface ActivityHeatmapProps {
  days: HeatmapDay[]; // oldest first
}

const SIZE = 11;
const GAP = 3;
const LABEL_W = 22;
const MONTH_H = 15;
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

// GitHub-style activity grid — ported from the original's canvas-free SVG
// C.heatmap: one hue, five levels, light -> dark, scaled to the day's max.
export function ActivityHeatmap({ days }: ActivityHeatmapProps) {
  if (!days.length) return <p className="chart-empty">Nothing to chart yet.</p>;

  const lead = new Date(days[0].ts).getDay();
  const cells: (HeatmapDay | null)[] = [...Array(lead).fill(null), ...days];
  const weeks = Math.ceil(cells.length / 7);
  const w = LABEL_W + weeks * (SIZE + GAP);
  const h = MONTH_H + 7 * (SIZE + GAP);
  const max = days.reduce((m, d) => Math.max(m, d.answered), 0) || 1;

  let lastMonth = -1;

  return (
    <div className="chart-host heat-host">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="chart-svg">
        {WEEKDAY_LABELS.map((lbl, r) => lbl && (
          <text key={r} x={0} y={MONTH_H + r * (SIZE + GAP) + SIZE - 1} className="chart-axis">{lbl}</text>
        ))}
        {cells.map((d, i) => {
          const wk = Math.floor(i / 7);
          const r = i % 7;
          const x = LABEL_W + wk * (SIZE + GAP);
          const y = MONTH_H + r * (SIZE + GAP);
          if (!d) return null;

          const date = new Date(d.ts);
          let monthLabel: string | null = null;
          if (date.getMonth() !== lastMonth && r <= 1) {
            lastMonth = date.getMonth();
            monthLabel = date.toLocaleDateString(undefined, { month: 'short' });
          }
          const lvl = !d.answered ? 0 : Math.max(1, Math.min(4, Math.ceil((d.answered / max) * 4)));
          const title = d.answered
            ? `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} — ${d.answered} answered · ${formatTime(d.seconds)}`
            : `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} — no study`;

          return (
            <g key={i}>
              {monthLabel && <text x={x} y={MONTH_H - 5} className="chart-axis">{monthLabel}</text>}
              <rect x={x} y={y} width={SIZE} height={SIZE} rx={3} className={`heat-cell lvl-${lvl}`}>
                <title>{title}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
