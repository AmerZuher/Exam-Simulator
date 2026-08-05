import { useContext } from 'react';
import { ExplanationContext } from '../contexts/ExplanationContext';

export function useExplanation() {
  const context = useContext(ExplanationContext);
  if (!context) {
    throw new Error('useExplanation must be used within an ExplanationProvider');
  }
  return context;
}
