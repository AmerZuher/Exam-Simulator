interface LineChartPoint {
  label: string;
  value: number;
  ok?: boolean;
  title?: string;
}

interface LineChartProps {
  points: LineChartPoint[];
  height?: number;
  threshold?: number;
  max?: number;
}

// Responsive SVG line chart — scales to its container via viewBox, no fixed
// pixel width, so it holds up across viewport sizes.
export function LineChart({ points, height = 200, threshold, max = 100 }: LineChartProps) {
  if (!points.length) return <p className="chart-empty">Nothing to chart yet.</p>;

  const w = 600;
  const padX = 10;
  const padY = 16;
  const innerW = w - padX * 2;
  const innerH = height - padY * 2;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const xy = (i: number, v: number) => {
    const x = padX + i * stepX;
    const y = padY + innerH - (Math.max(0, Math.min(max, v)) / max) * innerH;
    return [x, y] as const;
  };

  const linePoints = points.map((p, i) => xy(i, p.value).join(',')).join(' ');
  const thresholdY = threshold != null ? padY + innerH - (threshold / max) * innerH : null;

  // Thin out x-axis labels so they never overlap on narrow containers.
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="chart-host">
      <svg viewBox={`0 0 ${w} ${height + 18}`} width="100%" height={height + 18} preserveAspectRatio="xMidYMid meet">
        {thresholdY != null && (
          <line x1={padX} y1={thresholdY} x2={w - padX} y2={thresholdY} stroke="var(--line-strong)" strokeWidth={1} strokeDasharray="4 4" />
        )}
        <polyline points={linePoints} fill="none" stroke="var(--acc)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        {points.map((p, i) => {
          const [x, y] = xy(i, p.value);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={4} fill={p.ok === false ? 'var(--bad)' : p.ok === true ? 'var(--ok)' : 'var(--acc)'}>
                {p.title && <title>{p.title}</title>}
              </circle>
              {i % labelEvery === 0 && (
                <text x={x} y={height + 14} textAnchor="middle" fontSize={10} fill="var(--muted)">{p.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
