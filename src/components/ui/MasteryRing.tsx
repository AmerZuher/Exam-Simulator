interface MasteryRingProps {
  pct: number;
  size?: number;
  stroke?: number;
}

export function MasteryRing({ pct, size = 74, stroke = 7 }: MasteryRingProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (c * clamped) / 100;

  return (
    <div className="ring-wrap study-ring">
      <svg className="ring-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-val"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--acc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-label"><div className="ring-pct" style={{ fontSize: 17 }}>{clamped}%</div></div>
    </div>
  );
}
