interface LoadingStateProps {
  label?: string;
}

// Centered "Loading…" placeholder — used by every view while its initial
// data fetch is in flight, so the wording/spacing stays consistent app-wide.
export function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '4rem' }}>{label}</div>
  );
}
