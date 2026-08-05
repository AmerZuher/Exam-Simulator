import { Icon } from '../../utils/icons';
import type { QuestionType } from '../../types/exam';

export function TypeChip({ type }: { type: QuestionType }) {
  if (type === 'multiple') {
    return <span className="chip chip-warn"><Icon name="layers" size={11} strokeWidth={2.2} />Multi-choice</span>;
  }
  if (type === 'matching') {
    return <span className="chip chip-teal"><Icon name="link" size={11} strokeWidth={2.2} />Matching</span>;
  }
  return <span className="chip chip-acc"><Icon name="check" size={11} strokeWidth={2.4} />Single choice</span>;
}
