export interface ExamGroup {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  logo?: string | null;
  links: GroupLink[];
  created_at: string;
  updated_at: string;
}

export interface GroupLink {
  id: string;
  label: string;
  url: string;
}

export interface Exam {
  id: string;
  user_id: string;
  group_id?: string | null;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

export type QuestionType = 'single' | 'multiple' | 'matching';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | string;

export interface QuestionExplanation {
  correct?: string;
  incorrect?: string[];
}

// Mirrors the original vanilla app's rich question shape exactly, so the
// parser, Study/Review/Exam/Practice/Results views, and grading logic can
// all share one representation instead of lossy per-view reinterpretation.
export interface Question {
  id: string;
  exam_id: string;
  order: number;
  type: QuestionType;
  question: string;

  // single / multiple
  options: string[];
  correct_indices: number[];

  // matching
  left_items: string[];
  right_items: string[];
  correct_answers: Record<number, string>; // left_items index -> correct right_items value

  images: string[];
  audios: string[];
  videos: string[];
  explanation?: QuestionExplanation;
  difficulty?: Difficulty;

  created_at: string;
  updated_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  question_id: string;
  exam_id: string;
  grade: 1 | 2 | 3 | 4 | null; // SM-2: Again / Hard / Good / Easy — null until first graded
  ease_factor: number;
  interval: number;
  next_review: string;
  // Manual "I know this" star from Study mode — independent of SRS scheduling.
  mastered: boolean;
  // Count of "Again"-equivalent (grade 1) gradings — feeds the weak-spot
  // difficulty score alongside ease/accuracy.
  lapses: number;
  created_at: string;
  updated_at: string;
}

export interface AttemptResult {
  question_id: string;
  response: number | number[] | Record<number, string> | null;
  correct: boolean;
  skipped: boolean;
  flagged: boolean;
  time_spent_ms: number;
}

export type ExamAttemptMode = 'exam' | 'practice';

export interface AttemptOrigin {
  exam_id: string;
  question_id: string;
}

export interface ExamAttempt {
  id: string;
  user_id: string;
  // null only for a "custom exam" built across several banks at once —
  // see `origin`, which then records the real owning bank per question.
  exam_id: string | null;
  mode: ExamAttemptMode;
  label?: string;
  score: number; // percentage 0-100
  correct_count: number;
  total_questions: number;
  time_taken: number; // seconds
  pass_pct: number;
  passed: boolean;
  started_at: string;
  completed_at?: string;
  results: AttemptResult[];
  origin?: AttemptOrigin[] | null;
}

export interface UserProgress {
  id: string;
  user_id: string;
  exam_id: string;
  total_questions: number;
  mastered: number;
  due_for_review: number;
  never_seen: number;
  last_studied: string;
}
