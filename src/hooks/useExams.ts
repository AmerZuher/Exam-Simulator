import { useContext } from 'react';
import { ExamsContext } from '../contexts/ExamsContext';

export function useExams() {
  const context = useContext(ExamsContext);
  if (!context) {
    throw new Error('useExams must be used within an ExamsProvider');
  }
  return context;
}
