import { supabase } from './supabase';

export interface ActivityDay {
  day: string; // 'YYYY-MM-DD'
  answered: number;
  reviews: number;
  correct: number;
  seconds: number;
  attempts: number;
}

export interface QuestionPerf {
  question_id: string;
  exam_id: string;
  seen: number;
  correct: number;
  streak: number;
  worst: number;
  ms: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const activityService = {
  // Read-modify-write increment — mirrors the createOrUpdateStudySession
  // pattern already used elsewhere; day rows are small and per-user so the
  // extra round trip is cheap.
  async logActivity(userId: string, patch: Partial<Pick<ActivityDay, 'answered' | 'reviews' | 'correct' | 'seconds' | 'attempts'>>): Promise<void> {
    const day = todayKey();
    const { data: existing } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', userId)
      .eq('day', day)
      .maybeSingle();

    const merged = {
      user_id: userId,
      day,
      answered: (existing?.answered || 0) + (patch.answered || 0),
      reviews: (existing?.reviews || 0) + (patch.reviews || 0),
      correct: (existing?.correct || 0) + (patch.correct || 0),
      seconds: (existing?.seconds || 0) + (patch.seconds || 0),
      attempts: (existing?.attempts || 0) + (patch.attempts || 0),
    };
    const { error } = await supabase.from('activity_log').upsert(merged, { onConflict: 'user_id,day' });
    if (error) throw error;
  },

  // All activity rows, oldest first — callers slice the window they need
  // (heatmap: last 182 days; best-streak: everything).
  async getActivity(userId: string): Promise<ActivityDay[]> {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('day', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async recordQuestionPerf(userId: string, examId: string, questionId: string, correct: boolean, ms: number): Promise<void> {
    const { data: existing } = await supabase
      .from('question_perf')
      .select('*')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .maybeSingle();

    const seen = (existing?.seen || 0) + 1;
    const correctCount = (existing?.correct || 0) + (correct ? 1 : 0);
    const prevStreak = existing?.streak || 0;
    const streak = correct ? (prevStreak > 0 ? prevStreak + 1 : 1) : (prevStreak < 0 ? prevStreak - 1 : -1);
    const worst = (existing?.worst || 0) + (correct ? 0 : 1);
    let smoothedMs = existing?.ms || 0;
    if (ms > 0 && ms < 15 * 60 * 1000) {
      smoothedMs = smoothedMs ? Math.round(smoothedMs * 0.6 + ms * 0.4) : ms;
    }

    const merged = {
      user_id: userId, question_id: questionId, exam_id: examId,
      seen, correct: correctCount, streak, worst, ms: smoothedMs,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('question_perf').upsert(merged, { onConflict: 'user_id,question_id' });
    if (error) throw error;
  },

  async getQuestionPerf(userId: string, examIds: string[]): Promise<QuestionPerf[]> {
    if (!examIds.length) return [];
    const { data, error } = await supabase
      .from('question_perf')
      .select('question_id, exam_id, seen, correct, streak, worst, ms')
      .eq('user_id', userId)
      .in('exam_id', examIds);
    if (error) throw error;
    return data || [];
  },
};
