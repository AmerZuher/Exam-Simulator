import { useEffect, useState } from 'react';
import { examsService } from '../services/examsService';
import type { Question } from '../types/exam';

interface UseQuestionsReturn {
  questions: Question[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useQuestions(examId?: string): UseQuestionsReturn {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchQuestions = async () => {
    if (!examId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await examsService.getQuestions(examId);
      setQuestions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch questions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [examId]);

  return {
    questions,
    loading,
    error,
    refetch: fetchQuestions,
  };
}
