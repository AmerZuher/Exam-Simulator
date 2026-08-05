// SM-2 Spaced Repetition Algorithm
// https://en.wikipedia.org/wiki/SuperMemo#Algorithm_SM-2

export interface SRSState {
  easeFactor: number;
  interval: number;
  nextReview: Date;
}

export function calculateSRS(
  grade: 1 | 2 | 3 | 4,
  current: SRSState
): SRSState {
  // grade: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy

  let easeFactor = current.easeFactor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  if (easeFactor < 1.3) easeFactor = 1.3;

  let interval: number;
  if (grade < 3) {
    // If the answer is wrong or hard, reset interval
    interval = 1;
  } else {
    // Calculate next interval based on previous interval
    if (current.interval === 0 || current.interval === 1) {
      interval = 3;
    } else {
      interval = Math.round(current.interval * easeFactor);
    }
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    easeFactor,
    interval,
    nextReview,
  };
}

export function initializeSRS(): SRSState {
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + 1);
  return {
    easeFactor: 2.5,
    interval: 0,
    nextReview,
  };
}

export function isDueForReview(nextReview: Date): boolean {
  return new Date() >= nextReview;
}

export function daysUntilReview(nextReview: Date): number {
  const now = new Date();
  const diff = nextReview.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const DIFF_MIN_EASE = 1.3;
const DIFF_MAX_EASE = 3.0;

// Difficulty score in [0,1] — higher means "needs work". Blends miss rate,
// recent streak, lapses and SRS ease; ported from the original app's
// App.srs.difficulty (used to rank Progress's weak-spots list).
export function difficulty(
  perf: { seen: number; correct: number; streak: number },
  srs?: { easeFactor: number; lapses: number }
): number {
  if (!perf.seen && !srs) return 0.5; // unknown ⇒ middling
  const missRate = perf.seen ? 1 - perf.correct / perf.seen : 0.5;
  const ease = srs?.easeFactor ?? 2.5;
  const lapses = srs?.lapses ?? 0;
  const easePart = 1 - (ease - DIFF_MIN_EASE) / (DIFF_MAX_EASE - DIFF_MIN_EASE);
  const lapsePart = Math.min(1, lapses / 4);
  const streakPart = perf.streak < 0 ? Math.min(1, -perf.streak / 3) : 0;
  const d = missRate * 0.45 + easePart * 0.2 + lapsePart * 0.2 + streakPart * 0.15;
  return Math.max(0, Math.min(1, d));
}

// "0 -> now", "1 -> 1 day", "30 -> 1 mo"
export function fmtInterval(days: number): string {
  if (!days) return 'now';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}
