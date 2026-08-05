import { createContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { examsService } from '../services/examsService';
import { useAuth } from '../hooks/useAuth';
import { useExams } from '../hooks/useExams';
import type { Exam } from '../types/exam';

export interface BankStats {
  exam: Exam;
  count: number;
  types: { single: number; multiple: number; matching: number };
  attempts: number;
  best: number;
  mastered: number;
  due: number;
  retention: number;
  history: { pct: number }[];
}

export interface GlobalStats {
  banks: number;
  questions: number;
  attempts: number;
  avg: number;
  mastered: number;
  due: number;
  weak: number;
  streak: number;
  todayAnswered: number;
}

interface DashboardStatsContextType {
  loading: boolean;
  global: GlobalStats;
  banks: BankStats[];
  refetch: () => Promise<void>;
}

export const DashboardStatsContext = createContext<DashboardStatsContextType | undefined>(undefined);

const EMPTY_GLOBAL: GlobalStats = { banks: 0, questions: 0, attempts: 0, avg: 0, mastered: 0, due: 0, weak: 0, streak: 0, todayAnswered: 0 };

function computeStreak(activityDates: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  // A streak counts through today if there's activity today, otherwise it
  // must still include yesterday to still be "alive" (matches App.srs.streak()).
  if (!activityDates.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activityDates.has(cursor.toDateString())) return 0;
  }
  while (activityDates.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function DashboardStatsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { exams, loading: examsLoading } = useExams();
  const [loading, setLoading] = useState(true);
  const [global, setGlobal] = useState<GlobalStats>(EMPTY_GLOBAL);
  const [banks, setBanks] = useState<BankStats[]>([]);

  const fetchAll = useCallback(async () => {
    if (!user || examsLoading) return;
    if (!exams.length) {
      setGlobal(EMPTY_GLOBAL);
      setBanks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const activityDates = new Set<string>();
      const todayKey = new Date().toDateString();

      const perExam = await Promise.all(
        exams.map(async (exam) => {
          const [questions, sessions, attempts] = await Promise.all([
            examsService.getQuestionsLight(exam.id),
            examsService.getStudySessionsLight(user.id, exam.id),
            examsService.getExamAttemptsLight(user.id, exam.id),
          ]);
          return { exam, questions, sessions, attempts };
        })
      );

      let totalQuestions = 0;
      let totalAttempts = 0;
      let scoreSum = 0;
      let totalMastered = 0;
      let totalDue = 0;
      let totalWeak = 0;
      let todayAnswered = 0;
      const bankStats: BankStats[] = [];

      for (const { exam, questions, sessions, attempts } of perExam) {
        const now = new Date();
        const mastered = sessions.filter((s) => s.mastered).length;
        const due = sessions.filter((s) => s.grade != null && new Date(s.next_review) <= now).length;
        const weak = sessions.filter((s) => s.grade != null && s.ease_factor < 2.3).length;
        const retained = sessions.filter((s) => s.grade != null && s.interval >= 7).length;
        const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);
        const types = { single: 0, multiple: 0, matching: 0 };
        questions.forEach((q) => { types[q.type]++; });

        attempts.forEach((a) => {
          scoreSum += a.score;
          if (a.completed_at) {
            const day = new Date(a.completed_at).toDateString();
            activityDates.add(day);
            if (day === todayKey) todayAnswered += a.total_questions;
          }
        });
        sessions.forEach((s) => {
          if (s.updated_at) {
            const day = new Date(s.updated_at).toDateString();
            activityDates.add(day);
            if (day === todayKey) todayAnswered += 1;
          }
        });

        totalQuestions += questions.length;
        totalAttempts += attempts.length;
        totalMastered += mastered;
        totalDue += due;
        totalWeak += weak;

        bankStats.push({
          exam,
          count: questions.length,
          types,
          attempts: attempts.length,
          best,
          mastered,
          due,
          retention: questions.length ? Math.round((retained / questions.length) * 100) : 0,
          history: attempts.map((a) => ({ pct: a.score })),
        });
      }

      setGlobal({
        banks: exams.length,
        questions: totalQuestions,
        attempts: totalAttempts,
        avg: totalAttempts ? Math.round(scoreSum / totalAttempts) : 0,
        mastered: totalMastered,
        due: totalDue,
        weak: totalWeak,
        streak: computeStreak(activityDates),
        todayAnswered,
      });
      setBanks(bankStats);
    } finally {
      setLoading(false);
    }
  }, [user?.id, exams, examsLoading]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <DashboardStatsContext.Provider value={{ loading, global, banks, refetch: fetchAll }}>
      {children}
    </DashboardStatsContext.Provider>
  );
}
