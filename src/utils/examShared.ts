// Shared exam-taking logic used by Exam mode, Practice mode, and Results —
// question pools, cloning, shuffling, and grading. Ported from the original
// app/js/examShared.js, adapted to read pool membership from Supabase
// StudySession rows instead of a local SRS store.
import type { Question, QuestionType, StudySession } from '../types/exam';

export type PoolKey = 'all' | 'weak' | 'due' | 'fresh' | 'starred';

export const POOLS: Record<PoolKey, { label: string }> = {
  all: { label: 'Everything in the bank' },
  weak: { label: 'Weak spots — questions you keep missing' },
  due: { label: 'Due for review — what the scheduler picked' },
  fresh: { label: 'Never seen — questions you have not answered yet' },
  starred: { label: 'Mastered only — prove you still know them' },
};

function sessionsByQuestion(sessions: StudySession[]): Map<string, StudySession> {
  return new Map(sessions.map((s) => [s.question_id, s]));
}

export function resolvePool(questions: Question[], sessions: StudySession[], pool: PoolKey): Question[] {
  if (pool === 'all') return questions;
  const byQ = sessionsByQuestion(sessions);
  const now = new Date();

  if (pool === 'due') {
    return questions.filter((q) => {
      const s = byQ.get(q.id);
      return s && new Date(s.next_review) <= now;
    });
  }
  if (pool === 'fresh') {
    return questions.filter((q) => !byQ.has(q.id));
  }
  if (pool === 'starred') {
    return questions.filter((q) => !!byQ.get(q.id)?.mastered);
  }
  if (pool === 'weak') {
    // "keeps missing" ~ lowest ease factor among seen questions, worst first.
    return questions
      .filter((q) => byQ.has(q.id) && (byQ.get(q.id)?.ease_factor ?? 2.5) < 2.3)
      .sort((a, b) => (byQ.get(a.id)?.ease_factor ?? 0) - (byQ.get(b.id)?.ease_factor ?? 0));
  }
  return questions;
}

export function poolCount(questions: Question[], sessions: StudySession[], pool: PoolKey): number {
  return resolvePool(questions, sessions, pool).length;
}

export function cloneQuestion(q: Question): Question {
  return {
    ...q,
    options: q.options.slice(),
    correct_indices: q.correct_indices.slice(),
    images: (q.images || []).slice(),
    audios: (q.audios || []).slice(),
    videos: (q.videos || []).slice(),
    left_items: (q.left_items || []).slice(),
    right_items: (q.right_items || []).slice(),
    correct_answers: { ...q.correct_answers },
    explanation: q.explanation ? { ...q.explanation, incorrect: q.explanation.incorrect?.slice() } : undefined,
  };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffleQuestionOptions(q: Question): Question {
  if (q.type === 'matching') {
    const order = shuffle(q.left_items.map((_, i) => i));
    const newLeft = order.map((li) => q.left_items[li]);
    const newCorrect: Record<number, string> = {};
    order.forEach((li, newIdx) => { newCorrect[newIdx] = q.correct_answers[li]; });
    q.left_items = newLeft;
    q.correct_answers = newCorrect;
    q.right_items = shuffle(q.right_items);
    return q;
  }
  const order = shuffle(q.options.map((_, i) => i));
  const newOpts = order.map((oi) => q.options[oi]);
  const newCorrect: number[] = [];
  order.forEach((oi, newIdx) => { if (q.correct_indices.indexOf(oi) !== -1) newCorrect.push(newIdx); });
  q.options = newOpts;
  q.correct_indices = newCorrect;
  return q;
}

export function resolveTimeLimit(v: string, count: number): number {
  if (v === 'pace') return count * 90;
  const n = parseInt(v, 10);
  return isNaN(n) || n <= 0 ? 0 : n;
}

export type Response = number | number[] | Record<number, string> | undefined;

export function isAnswered(q: Question, resp: Response): boolean {
  if (q.type === 'matching') {
    const r = resp as Record<number, string> | undefined;
    return !!(r && Object.keys(r).some((k) => r[Number(k)]));
  }
  return resp !== undefined && (!Array.isArray(resp) || resp.length > 0);
}

export interface Grade {
  isCorrect: boolean;
  isSkipped: boolean;
}

export function gradeQuestion(q: Question, resp: Response): Grade {
  let isCorrect = false;
  let isSkipped = false;
  if (q.type === 'single') {
    isSkipped = resp === undefined;
    isCorrect = !isSkipped && q.correct_indices.indexOf(resp as number) !== -1;
  } else if (q.type === 'multiple') {
    const r = resp as number[] | undefined;
    isSkipped = !r || !r.length;
    isCorrect = !isSkipped && r!.length === q.correct_indices.length && r!.every((v) => q.correct_indices.indexOf(v) !== -1);
  } else {
    const r = resp as Record<number, string> | undefined;
    isSkipped = !r || !Object.keys(r).some((k) => r[Number(k)]);
    isCorrect = !isSkipped && q.left_items.every((_, li) => r![li] === q.correct_answers[li]);
  }
  return { isCorrect, isSkipped };
}

export function medianOf(arr: number[]): number {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

export function typeLabel(type: QuestionType): string {
  return type === 'single' ? 'Single' : type === 'multiple' ? 'Multiple' : 'Matching';
}
