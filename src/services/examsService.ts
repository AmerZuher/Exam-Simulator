import { supabase } from './supabase';
import type { Exam, ExamGroup, GroupLink, Question, QuestionType, StudySession, ExamAttempt } from '../types/exam';

export interface QuestionLight {
  id: string;
  type: QuestionType;
}

export interface StudySessionLight {
  id: string;
  question_id: string;
  grade: 1 | 2 | 3 | 4 | null;
  ease_factor: number;
  interval: number;
  next_review: string;
  mastered: boolean;
  updated_at: string;
}

export interface ExamAttemptLight {
  id: string;
  exam_id: string;
  score: number;
  total_questions: number;
  completed_at?: string;
}

export const examsService = {
  async getExams(userId: string): Promise<Exam[]> {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async createExam(exam: Omit<Exam, 'id' | 'created_at' | 'updated_at'>): Promise<Exam> {
    const { data, error } = await supabase
      .from('exams')
      .insert([exam])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateExam(id: string, updates: Partial<Exam>): Promise<Exam> {
    const { data, error } = await supabase
      .from('exams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteExam(id: string): Promise<void> {
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) throw error;
  },

  async getQuestions(examId: string): Promise<Question[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('exam_id', examId)
      .order('order', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Stats-only variant: just enough to count questions and tally type, without
  // pulling options/images/audio/video/explanation for every question.
  async getQuestionsLight(examId: string): Promise<QuestionLight[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('id, type')
      .eq('exam_id', examId);
    if (error) throw error;
    return data || [];
  },

  async createQuestion(question: Omit<Question, 'id' | 'created_at' | 'updated_at'>): Promise<Question> {
    const { data, error } = await supabase
      .from('questions')
      .insert([question])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createQuestions(questions: Omit<Question, 'id' | 'created_at' | 'updated_at'>[]): Promise<Question[]> {
    const { data, error } = await supabase
      .from('questions')
      .insert(questions)
      .select();
    if (error) throw error;
    return data || [];
  },

  async deleteQuestion(id: string): Promise<void> {
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw error;
  },

  async getStudySessions(userId: string, examId?: string): Promise<StudySession[]> {
    let query = supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId);
    if (examId) query = query.eq('exam_id', examId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Stats-only variant of getStudySessions — drops user_id/exam_id/created_at,
  // which the dashboard aggregation never reads.
  async getStudySessionsLight(userId: string, examId?: string): Promise<StudySessionLight[]> {
    let query = supabase
      .from('study_sessions')
      .select('id, question_id, grade, ease_factor, interval, next_review, mastered, updated_at')
      .eq('user_id', userId);
    if (examId) query = query.eq('exam_id', examId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createOrUpdateStudySession(session: Omit<StudySession, 'created_at' | 'updated_at'>): Promise<StudySession> {
    const { data, error } = await supabase
      .from('study_sessions')
      .upsert([session], { onConflict: 'user_id,question_id,exam_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Toggles the manual mastery star, creating a bare session row (no grade
  // yet) if this question has never been reviewed before.
  async toggleMastered(userId: string, examId: string, questionId: string, existing?: StudySession): Promise<StudySession> {
    const nextMastered = !(existing?.mastered ?? false);
    const { data, error } = await supabase
      .from('study_sessions')
      .upsert(
        [{
          id: existing?.id,
          user_id: userId,
          exam_id: examId,
          question_id: questionId,
          grade: existing?.grade ?? null,
          ease_factor: existing?.ease_factor ?? 2.5,
          interval: existing?.interval ?? 0,
          next_review: existing?.next_review ?? new Date().toISOString(),
          mastered: nextMastered,
        }],
        { onConflict: 'user_id,question_id,exam_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async resetMastery(userId: string, examId: string): Promise<void> {
    const { error } = await supabase
      .from('study_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('exam_id', examId);
    if (error) throw error;
  },

  async getExamAttempt(id: string): Promise<ExamAttempt> {
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getExamAttempts(userId: string, examId?: string): Promise<ExamAttempt[]> {
    let query = supabase
      .from('exam_attempts')
      .select('*')
      .eq('user_id', userId);
    if (examId) query = query.eq('exam_id', examId);
    const { data, error } = await query.order('completed_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Stats-only variant — excludes the potentially large per-question `results`
  // jsonb array, which the dashboard aggregation never reads.
  async getExamAttemptsLight(userId: string, examId?: string): Promise<ExamAttemptLight[]> {
    let query = supabase
      .from('exam_attempts')
      .select('id, exam_id, score, total_questions, completed_at')
      .eq('user_id', userId);
    if (examId) query = query.eq('exam_id', examId);
    const { data, error } = await query.order('completed_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createExamAttempt(attempt: Omit<ExamAttempt, 'id'>): Promise<ExamAttempt> {
    const { data, error } = await supabase
      .from('exam_attempts')
      .insert([attempt])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ---- Exam groups ----

  async getGroups(userId: string): Promise<ExamGroup[]> {
    const { data, error } = await supabase
      .from('exam_groups')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async createGroup(group: Omit<ExamGroup, 'id' | 'created_at' | 'updated_at' | 'links'>): Promise<ExamGroup> {
    const { data, error } = await supabase
      .from('exam_groups')
      .insert([{ ...group, links: [] }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateGroup(id: string, updates: Partial<ExamGroup>): Promise<ExamGroup> {
    const { data, error } = await supabase
      .from('exam_groups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteGroup(id: string): Promise<void> {
    // Member exams move back to ungrouped rather than being deleted.
    const { error: unlinkError } = await supabase
      .from('exams')
      .update({ group_id: null })
      .eq('group_id', id);
    if (unlinkError) throw unlinkError;

    const { error } = await supabase.from('exam_groups').delete().eq('id', id);
    if (error) throw error;
  },

  async addGroupLink(groupId: string, links: GroupLink[]): Promise<ExamGroup> {
    const { data, error } = await supabase
      .from('exam_groups')
      .update({ links })
      .eq('id', groupId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
