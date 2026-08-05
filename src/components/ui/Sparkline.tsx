interface SparklineProps {
  values: number[];
  w?: number;
  h?: number;
}

export function Sparkline({ values, w = 96, h = 26 }: SparklineProps) {
  if (!values || !values.length) return null;
  const max = 100;
  const min = 0;
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => {
    const x = (i * stepX).toFixed(1);
    const y = (h - 3 - ((v - min) / (max - min)) * (h - 6)).toFixed(1);
    return `${x},${y}`;
  });
  const last = pts[pts.length - 1].split(',');

  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--acc)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill="var(--acc)" />
    </svg>
  );
}
