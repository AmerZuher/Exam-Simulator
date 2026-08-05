import { ReactNode } from 'react';
import { Icon, IconName } from '../../utils/icons';

interface SectionButtonProps {
  icon: IconName;
  children: ReactNode;
  onClick: () => void;
  variant?: 'ghost' | 'primary' | 'soft' | 'danger';
  disabled?: boolean;
}

// The small action button that sits beside a section title (.sec-head
// .sec-actions) — Dashboard's "New group"/"Import", Group's "Add link"/
// "Manage banks", etc. Sharing one component keeps them all the same size
// regardless of label length, instead of each view hand-rolling its own
// <button className="btn btn-ghost btn-sm">.
export function SectionButton({ icon, children, onClick, variant = 'ghost', disabled }: SectionButtonProps) {
  return (
    <button className={`btn btn-${variant} btn-sm sec-btn`} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={14} />
      <span>{children}</span>
    </button>
  );
}
