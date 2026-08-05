import { Icon } from '../../utils/icons';
import { fmtInterval } from '../../utils/srs';
import type { StudySession } from '../../types/exam';

export function ScheduleChip({ session }: { session?: StudySession }) {
  if (!session || session.grade == null) {
    return <span className="chip chip-mut">New</span>;
  }
  const due = new Date(session.next_review) <= new Date();
  if (due) {
    return <span className="chip chip-warn"><Icon name="cards" size={10} strokeWidth={2.2} />Due now</span>;
  }
  const days = Math.max(1, Math.ceil((new Date(session.next_review).getTime() - Date.now()) / 86400000));
  return (
    <span className="chip chip-mut" title={`Next review in ${fmtInterval(days)}`}>
      <Icon name="clock" size={10} strokeWidth={2.2} />in {fmtInterval(days)}
    </span>
  );
}
