import type { ReactNode } from 'react';
import { Icon } from '../../utils/icons';
import type { Question } from '../../types/exam';
import type { Response } from '../../utils/examShared';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// "Your answer vs. the correct answer" review markup — shared by Results
// and Practice mode's per-question checked state.
export function AnswerReview({ q, resp }: { q: Question; resp: Response }) {
  if (q.type === 'matching') {
    const r = (resp as Record<number, string>) || {};
    return (
      <div className="match-pairs">
        {q.left_items.map((left, li) => {
          const yours = r[li] || '—';
          const expected = q.correct_answers[li] || '—';
          const ok = yours === expected;
          return (
            <div className={`match-pair ${ok ? 'is-ok' : 'is-wrong'}`} key={li}>
              <div className="mp-l">
                {left}
                {!ok && <div className="mp-expected">Expected: {expected}</div>}
              </div>
              <div className="mp-arrow"><Icon name={ok ? 'check' : 'x'} size={15} strokeWidth={2.2} /></div>
              <div className="mp-r">{yours}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="opt-list">
      {q.options.map((opt, oi) => {
        const wasChosen = q.type === 'single' ? resp === oi : Array.isArray(resp) && resp.indexOf(oi) !== -1;
        const isAnswer = q.correct_indices.indexOf(oi) !== -1;
        let cls = 'opt-row';
        let tag: ReactNode = null;
        let letter: ReactNode = LETTERS[oi % 26];
        if (wasChosen && isAnswer) {
          cls += ' is-correct'; tag = <span className="opt-tag t-ok">Your answer</span>; letter = <Icon name="check" size={12} strokeWidth={3} />;
        } else if (wasChosen && !isAnswer) {
          cls += ' is-wrong'; tag = <span className="opt-tag t-bad">Your pick</span>; letter = <Icon name="x" size={12} strokeWidth={3} />;
        } else if (!wasChosen && isAnswer) {
          cls += ' is-missed'; tag = <span className="opt-tag t-acc">Correct answer</span>; letter = <Icon name="check" size={12} strokeWidth={3} />;
        }
        return (
          <div className={cls} key={oi}>
            <span className="opt-letter">{letter}</span>
            <span>{opt}</span>
            {tag}
          </div>
        );
      })}
    </div>
  );
}
