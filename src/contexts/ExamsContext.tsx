import { createContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { examsService } from '../services/examsService';
import { useAuth } from '../hooks/useAuth';
import type { Exam } from '../types/exam';

interface CreateExamOptions {
  description?: string;
  icon?: string;
  color?: string;
  group_id?: string | null;
}

interface ExamsContextType {
  exams: Exam[];
  loading: boolean;
  error: Error | null;
  createExam: (name: string, opts?: CreateExamOptions) => Promise<Exam>;
  updateExam: (id: string, updates: Partial<Exam>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export const ExamsContext = createContext<ExamsContextType | undefined>(undefined);

export function ExamsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchExams = useCallback(async () => {
    if (!user) {
      setExams([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await examsService.getExams(user.id);
      setExams(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch exams'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const createExam = async (name: string, opts?: CreateExamOptions): Promise<Exam> => {
    if (!user) throw new Error('User not authenticated');
    const exam = await examsService.createExam({ user_id: user.id, name, ...opts });
    setExams((prev) => [...prev, exam]);
    return exam;
  };

  const updateExam = async (id: string, updates: Partial<Exam>) => {
    await examsService.updateExam(id, updates);
    setExams((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const deleteExam = async (id: string) => {
    await examsService.deleteExam(id);
    setExams((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <ExamsContext.Provider value={{ exams, loading, error, createExam, updateExam, deleteExam, refetch: fetchExams }}>
      {children}
    </ExamsContext.Provider>
  );
}
