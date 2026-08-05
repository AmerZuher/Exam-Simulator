import { createContext, useCallback, useState, ReactNode } from 'react';
import { Icon } from '../utils/icons';
import type { Question } from '../types/exam';

interface ExplanationContextType {
  showExplanation: (q: Question) => void;
}

export const ExplanationContext = createContext<ExplanationContextType | undefined>(undefined);

// Ported from the original App.ui.explainModal — a single shared modal
// (not an inline box) used by Study mode's per-question lightbulb button
// and Results' answer-review cards.
export function ExplanationProvider({ children }: { children: ReactNode }) {
  const [question, setQuestion] = useState<Question | null>(null);

  const showExplanation = useCallback((q: Question) => {
    if (!q.explanation) return;
    setQuestion(q);
  }, []);

  const close = () => setQuestion(null);

  return (
    <ExplanationContext.Provider value={{ showExplanation }}>
      {children}
      {question && (
        <div className="modal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Icon name="lightbulb" size={16} />Explanation
                </div>
              </div>
              <button className="icon-btn" onClick={close}><Icon name="x" size={15} /></button>
            </div>
            <div className="explain-body">
              {question.explanation?.correct ? (
                <p>{question.explanation.correct}</p>
              ) : (
                <p style={{ color: 'var(--muted)' }}>No reasoning was saved for the correct answer.</p>
              )}
              {question.explanation?.incorrect && question.explanation.incorrect.length > 0 && (
                <>
                  <label className="field-lbl" style={{ marginTop: 14, display: 'block' }}>Why the other options are wrong</label>
                  <ul className="explain-list">
                    {question.explanation.incorrect.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-primary" onClick={close}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </ExplanationContext.Provider>
  );
}
